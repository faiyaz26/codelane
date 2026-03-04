use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;
use anyhow::{Context, Result};

use crate::paths;
use super::manifest::{Extension, ExtensionManifest};
use super::rpc::{JsonRpcRequest, JsonRpcResponse, handle_request};

#[derive(Clone)]
pub struct ExtensionState {
    pub extensions: Arc<Mutex<HashMap<String, Extension>>>,
    pub last_scanned: Arc<Mutex<Option<std::time::Instant>>>,
    pub subscriptions: Arc<Mutex<HashMap<String, Vec<String>>>>, // Topic -> Vec<ExtensionId>
}

impl ExtensionState {
    pub fn new() -> Self {
        Self {
            extensions: Arc::new(Mutex::new(HashMap::new())),
            last_scanned: Arc::new(Mutex::new(None)),
            subscriptions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Discover extensions in the extensions directory
    pub async fn discover_extensions(&self) -> Result<()> {
        let mut extensions_dirs = vec![paths::extensions_dir()];
        
        // In development, also look in the local extensions directory
        if cfg!(debug_assertions) {
            if let Ok(cwd) = std::env::current_dir() {
                let local_exts = cwd.join("extensions");
                if local_exts.exists() && local_exts.is_dir() {
                    extensions_dirs.push(local_exts);
                }
            }
        }

        let mut extensions = self.extensions.lock().await;

        for dir in extensions_dirs {
            if !dir.exists() {
                continue;
            }

            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    let manifest_path = path.join("manifest.json");
                    if manifest_path.exists() {
                        let manifest_content = std::fs::read_to_string(&manifest_path)?;
                        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)?;
                        
                        let id = manifest.id.clone();
                        if let Some(existing) = extensions.get_mut(&id) {
                            // Preserve running state but update manifest/path
                            existing.manifest = manifest;
                            existing.path = path.to_path_buf();
                        } else {
                            extensions.insert(id, Extension {
                                manifest,
                                path: path.to_path_buf(),
                                child_process: None,
                                stdin: None,
                                is_running: false,
                            });
                        }
                    }
                        }
                        }        }

        let mut last_scanned = self.last_scanned.lock().await;
        *last_scanned = Some(std::time::Instant::now());
        Ok(())
    }

    /// Load and start an extension
    pub async fn start_extension(&self, app: AppHandle, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.lock().await;
        let extension = extensions.get_mut(extension_id)
            .context(format!("Extension {} not found", extension_id))?;

        if extension.is_running {
            return Ok(()); // Already running
        }

        let main_backend = match &extension.manifest.main_backend {
            Some(backend) => backend.clone(),
            None => {
                // If there's no backend, we just consider it "started" so the frontend can load
                tracing::info!("[Extension {}] Starting frontend-only extension", extension_id);
                extension.is_running = true;
                return Ok(());
            }
        };

        let backend_path = extension.path.join(main_backend);
        if !backend_path.exists() {
            return Err(anyhow::anyhow!("Backend entry point not found at {:?}", backend_path));
        }

        // Determine how to run the backend (binary vs script)
        let mut command = if backend_path.extension().and_then(|s| s.to_str()) == Some("js") {
            let mut cmd = Command::new("node");
            cmd.arg(&backend_path);
            cmd
        } else {
            Command::new(&backend_path)
        };

        command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        let mut child = command.spawn()
            .context(format!("Failed to spawn backend for extension {}", extension_id))?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let stdin = child.stdin.take().unwrap(); 

        let stdin_arc = Arc::new(Mutex::new(stdin));
        extension.stdin = Some(stdin_arc.clone());
        extension.child_process = Some(Arc::new(Mutex::new(child)));
        extension.is_running = true;

        let permissions = extension.manifest.permissions.clone();
        
        // Monitor process for unexpected exit
        let ext_id_for_monitor = extension_id.to_string();
        let app_for_monitor = app.clone();
        let ext_state_for_monitor = self.clone();
        let child_arc_for_monitor = extension.child_process.as_ref().unwrap().clone();
        
        tokio::spawn(async move {
            let mut child = child_arc_for_monitor.lock().await;
            match child.wait().await {
                Ok(status) => {
                    if !status.success() {
                        tracing::error!("[Extension {}] Process exited with error: {}", ext_id_for_monitor, status);
                        // Notify frontend
                        let _ = app_for_monitor.emit("extension:crashed", serde_json::json!({
                            "id": ext_id_for_monitor,
                            "code": status.code()
                        }));
                    } else {
                        tracing::info!("[Extension {}] Process exited cleanly", ext_id_for_monitor);
                    }
                }
                Err(e) => {
                    tracing::error!("[Extension {}] Failed to wait for process: {}", ext_id_for_monitor, e);
                }
            }
            
            // Cleanup state
            let mut extensions = ext_state_for_monitor.extensions.lock().await;
            if let Some(ext) = extensions.get_mut(&ext_id_for_monitor) {
                ext.child_process = None;
                ext.stdin = None;
                ext.is_running = false;
            }
        });

        // Handle stdout for JSON-RPC
        let extension_id_rpc = extension_id.to_string();
        let app_rpc = app.clone();
        let stdin_rpc = stdin_arc.clone();
        tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(&line) {
                    let id = request.id.clone();
                    
                    let result = handle_request(&app_rpc, &extension_id_rpc, request, &permissions).await;

                    if let Some(rpc_id) = id {
                        let response = match result {
                            Ok(res) => JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                result: Some(res),
                                error: None,
                                id: Some(rpc_id),
                            },
                            Err(err) => JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                result: None,
                                error: Some(err),
                                id: Some(rpc_id),
                            },
                        };

                        if let Ok(resp_line) = serde_json::to_string(&response) {
                            let mut stdin_lock = stdin_rpc.lock().await;
                            let _ = stdin_lock.write_all(format!("{}\n", resp_line).as_bytes()).await;
                            let _ = stdin_lock.flush().await;
                        }
                    }
                } else {
                    tracing::info!("[Extension {}] stdout: {}", extension_id_rpc, line);
                }
            }
        });

        // Handle stderr for logging
        let extension_id_clone = extension_id.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                tracing::error!("[Extension {}] stderr: {}", extension_id_clone, line);
            }
        });

        Ok(())
    }

    /// Stop an extension
    pub async fn stop_extension(&self, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.lock().await;
        let extension = extensions.get_mut(extension_id)
            .context(format!("Extension {} not found", extension_id))?;

        if let Some(child_arc) = extension.child_process.take() {
            let mut child = child_arc.lock().await;
            let _ = child.start_kill();
        }
        
        extension.stdin = None;
        extension.is_running = false;

        // Cleanup subscriptions
        let mut subscriptions = self.subscriptions.lock().await;
        for subs in subscriptions.values_mut() {
            subs.retain(|id| id != extension_id);
        }

        Ok(())
    }

    /// Uninstall an extension
    pub async fn uninstall_extension(&self, extension_id: &str) -> Result<()> {
        // First stop it
        let _ = self.stop_extension(extension_id).await;

        let mut extensions = self.extensions.lock().await;
        if let Some(extension) = extensions.remove(extension_id) {
            if extension.path.exists() {
                std::fs::remove_dir_all(&extension.path)?;
            }
        }

        Ok(())
    }

    /// Automatically start extensions based on persistent settings
    pub async fn auto_start_extensions(&self, app: AppHandle, enabled_ids: Vec<String>) -> Result<()> {
        // Ensure discovery is done first
        self.discover_extensions().await?;
        
        for id in enabled_ids {
            tracing::info!("Auto-starting extension: {}", id);
            if let Err(e) = self.start_extension(app.clone(), &id).await {
                tracing::error!("Failed to auto-start extension {}: {}", id, e);
            }
        }
        
        Ok(())
    }

    /// Subscribe an extension to a topic
    pub async fn subscribe(&self, extension_id: String, topic: String) {
        let mut subscriptions = self.subscriptions.lock().await;
        subscriptions.entry(topic).or_default().push(extension_id);
    }

    /// Broadcast an event to all subscribers of a topic
    pub async fn broadcast(&self, topic: &str, method: &str, params: serde_json::Value) {
        let extension_ids = {
            let subscriptions = self.subscriptions.lock().await;
            subscriptions.get(topic).cloned().unwrap_or_default()
        };

        if extension_ids.is_empty() {
            return;
        }

        let event = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        });

        let event_line = format!("{}\n", event.to_string());
        let extensions = self.extensions.lock().await;

        for id in extension_ids {
            if let Some(ext) = extensions.get(&id) {
                if let Some(stdin_arc) = &ext.stdin {
                    let stdin_arc = stdin_arc.clone();
                    let event_line = event_line.clone();
                    tokio::spawn(async move {
                        use tokio::io::AsyncWriteExt;
                        let mut stdin = stdin_arc.lock().await;
                        let _ = stdin.write_all(event_line.as_bytes()).await;
                        let _ = stdin.flush().await;
                    });
                }
            }
        }
    }

    /// Install an extension from a URL
    pub async fn install_extension(&self, download_url: &str, expected_sha256: &str) -> Result<()> {
        let extensions_dir = paths::extensions_dir();
        if !extensions_dir.exists() {
            std::fs::create_dir_all(&extensions_dir)?;
        }

        tracing::info!("Downloading extension from {}", download_url);
        let response = reqwest::get(download_url).await?;
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Failed to download extension: {}", response.status()));
        }

        let content = response.bytes().await?;
        
        // Verify checksum
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let actual_sha256 = hex::encode(hasher.finalize());
        
        if actual_sha256 != expected_sha256 {
            return Err(anyhow::anyhow!("Checksum mismatch! Expected: {}, Got: {}", expected_sha256, actual_sha256));
        }

        let reader = std::io::Cursor::new(content);

        // Extract to a temporary directory first to read manifest
        let temp_dir = tempfile::tempdir()?;
        zip_extract::extract(reader, temp_dir.path(), true)?;

        // Find the manifest.json
        let manifest_path = temp_dir.path().join("manifest.json");
        if !manifest_path.exists() {
            // Check if it's inside a nested directory (common in zip files)
            let mut entries = std::fs::read_dir(temp_dir.path())?;
            if let Some(Ok(entry)) = entries.next() {
                if entry.path().is_dir() {
                    let nested_manifest = entry.path().join("manifest.json");
                    if nested_manifest.exists() {
                        return self.move_and_register(&entry.path(), &extensions_dir).await;
                    }
                }
            }
            return Err(anyhow::anyhow!("manifest.json not found in extension package"));
        }

        self.move_and_register(temp_dir.path(), &extensions_dir).await
    }

    async fn move_and_register(&self, source: &Path, extensions_dir: &Path) -> Result<()> {
        let manifest_content = std::fs::read_to_string(source.join("manifest.json"))?;
        let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)?;
        
        let target_dir = extensions_dir.join(&manifest.id);
        if target_dir.exists() {
            std::fs::remove_dir_all(&target_dir)?;
        }
        
        // Copy files (recursive move is not built-in for cross-device)
        self.copy_dir_all(source, &target_dir)?;

        // Update local state
        let mut extensions = self.extensions.lock().await;
        extensions.insert(manifest.id.clone(), Extension {
            manifest,
            path: target_dir,
            child_process: None,
            stdin: None,
            is_running: false,
        });

        Ok(())
    }

    fn copy_dir_all(&self, src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
        std::fs::create_dir_all(&dst)?;
        for entry in std::fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            if ty.is_dir() {
                self.copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
            } else {
                std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
            }
        }
        Ok(())
    }
}
