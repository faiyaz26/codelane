use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use anyhow::{Context, Result};

use crate::paths;
use super::manifest::{Extension, ExtensionManifest};
use super::rpc::{JsonRpcRequest, JsonRpcResponse, handle_request};

pub struct ExtensionState {
    pub extensions: Arc<Mutex<HashMap<String, Extension>>>,
    pub last_scanned: Arc<Mutex<Option<std::time::Instant>>>,
}

impl ExtensionState {
    pub fn new() -> Self {
        Self {
            extensions: Arc::new(Mutex::new(HashMap::new())),
            last_scanned: Arc::new(Mutex::new(None)),
        }
    }

    /// Discover extensions in the extensions directory
    pub fn discover_extensions(&self) -> Result<()> {
        let extensions_dir = paths::extensions_dir();
        
        if !extensions_dir.exists() {
            tracing::debug!("Extensions directory does not exist at {:?}", extensions_dir);
            let mut last_scanned = self.last_scanned.lock().unwrap();
            *last_scanned = Some(std::time::Instant::now());
            return Ok(());
        }

        let mut extensions = self.extensions.lock().unwrap();

        for entry in std::fs::read_dir(extensions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    let manifest_content = std::fs::read_to_string(&manifest_path)?;
                    let manifest: ExtensionManifest = serde_json::from_str(&manifest_content)?;
                    
                    extensions.entry(manifest.id.clone()).or_insert_with(|| Extension {
                        manifest,
                        path: path.to_path_buf(),
                        child_process: None,
                    });
                }
            }
        }

        let mut last_scanned = self.last_scanned.lock().unwrap();
        *last_scanned = Some(std::time::Instant::now());
        Ok(())
    }

    /// Load and start an extension
    pub async fn start_extension(&self, app: AppHandle, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.lock().unwrap();
        let extension = extensions.get_mut(extension_id)
            .context(format!("Extension {} not found", extension_id))?;

        if extension.child_process.is_some() {
            return Ok(()); // Already running
        }

        let main_backend = extension.manifest.main_backend.as_ref()
            .context(format!("Extension {} has no backend entry point", extension_id))?;

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
        let mut stdin = child.stdin.take().unwrap(); 

        let extension_id_clone = extension_id.to_string();
        let app_handle = app.clone();
        let permissions = extension.manifest.permissions.clone();
        
        // Handle stdout for JSON-RPC
        tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(request) = serde_json::from_str::<JsonRpcRequest>(&line) {
                    let id = request.id.clone();
                    
                    let result = handle_request(&app_handle, request, &permissions).await;

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
                            let _ = stdin.write_all(format!("{}\n", resp_line).as_bytes()).await;
                            let _ = stdin.flush().await;
                        }
                    }
                } else {
                    tracing::info!("[Extension {}] stdout: {}", extension_id_clone, line);
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

        extension.child_process = Some(Arc::new(Mutex::new(child)));

        Ok(())
    }

    /// Stop an extension
    pub fn stop_extension(&self, extension_id: &str) -> Result<()> {
        let mut extensions = self.extensions.lock().unwrap();
        let extension = extensions.get_mut(extension_id)
            .context(format!("Extension {} not found", extension_id))?;

        if let Some(child_arc) = extension.child_process.take() {
            let mut child = child_arc.lock().unwrap();
            let _ = child.start_kill();
        }

        Ok(())
    }
}
