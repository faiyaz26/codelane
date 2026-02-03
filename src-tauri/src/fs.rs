//! Filesystem Commands
//!
//! This module provides Tauri commands for filesystem operations.
//! While Tauri provides built-in FS plugins, these commands offer
//! additional functionality specific to Codelane's needs.

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// File entry information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>, // Unix timestamp
}

/// File watch event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileWatchEvent {
    pub watch_id: String,
    pub path: String,
    pub kind: String, // "create", "modify", "delete", "rename"
}

/// File stats for external change detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStats {
    pub modified: Option<u64>,
    pub size: u64,
}

/// Watch handle identifier
pub type WatchId = String;

/// Managed state for file watchers
pub struct FileWatchState {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl FileWatchState {
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }
}

/// Read a file's contents
#[tauri::command]
pub async fn read_file(
    path: String,
    _encoding: Option<String>,
) -> Result<String, String> {
    tracing::debug!("Reading file: {}", path);

    let contents = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(contents)
}

/// Write contents to a file
#[tauri::command]
pub async fn write_file(
    path: String,
    contents: String,
    create_dirs: Option<bool>,
) -> Result<(), String> {
    tracing::debug!("Writing file: {}", path);

    if create_dirs.unwrap_or(false) {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
    }

    tokio::fs::write(&path, contents)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// List contents of a directory
#[tauri::command]
pub async fn list_directory(
    path: String,
    _recursive: Option<bool>,
    include_hidden: Option<bool>,
) -> Result<Vec<FileEntry>, String> {
    tracing::debug!("Listing directory: {}", path);

    let include_hidden = include_hidden.unwrap_or(false);
    let mut entries = Vec::new();

    let mut dir = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| format!("Failed to read entry: {}", e))? {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files unless requested
        if !include_hidden && name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().await.ok();
        let file_type = entry.file_type().await.ok();

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: file_type.as_ref().map(|t| t.is_dir()).unwrap_or(false),
            is_file: file_type.as_ref().map(|t| t.is_file()).unwrap_or(false),
            is_symlink: file_type.as_ref().map(|t| t.is_symlink()).unwrap_or(false),
            size: metadata.as_ref().map(|m| m.len()),
            modified: metadata.as_ref().and_then(|m| {
                m.modified().ok().and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())
                })
            }),
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Get file stats (modification time and size)
#[tauri::command]
pub async fn get_file_stats(path: String) -> Result<FileStats, String> {
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|e| format!("Failed to get file stats: {}", e))?;

    Ok(FileStats {
        modified: metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
        size: metadata.len(),
    })
}

/// Start watching a path for changes
#[tauri::command]
pub async fn watch_path(
    app: AppHandle,
    state: tauri::State<'_, FileWatchState>,
    path: String,
    recursive: Option<bool>,
) -> Result<WatchId, String> {
    tracing::info!("Starting file watch on: {}", path);

    // Verify path exists
    if !Path::new(&path).exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let watch_id = uuid::Uuid::new_v4().to_string();
    let watch_id_for_thread = watch_id.clone();
    let watch_id_for_storage = watch_id.clone();

    let (tx, rx) = mpsc::channel();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("Failed to create watcher: {}", e))?;

    let mode = if recursive.unwrap_or(true) {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    watcher
        .watch(Path::new(&path), mode)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    // Store watcher
    {
        let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
        watchers.insert(watch_id_for_storage, watcher);
    }

    // Spawn thread to handle events
    std::thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            match result {
                Ok(event) => {
                    let kind = match &event.kind {
                        notify::EventKind::Create(_) => "create",
                        notify::EventKind::Modify(m) => {
                            match m {
                                notify::event::ModifyKind::Name(_) => "rename",
                                _ => "modify",
                            }
                        }
                        notify::EventKind::Remove(_) => "delete",
                        _ => continue,
                    };

                    for path in event.paths {
                        let watch_event = FileWatchEvent {
                            watch_id: watch_id_for_thread.clone(),
                            path: path.to_string_lossy().to_string(),
                            kind: kind.to_string(),
                        };

                        let _ = app.emit("file-watch-event", &watch_event);
                    }
                }
                Err(_) => {}
            }
        }
    });

    Ok(watch_id)
}

/// Stop watching a path
#[tauri::command]
pub async fn unwatch_path(
    state: tauri::State<'_, FileWatchState>,
    watch_id: WatchId,
) -> Result<(), String> {
    tracing::info!("Stopping file watch: {}", watch_id);

    let mut watchers = state.watchers.lock().map_err(|e| e.to_string())?;
    watchers.remove(&watch_id);

    Ok(())
}
