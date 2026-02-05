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

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== FileEntry Tests ====================

    #[test]
    fn test_file_entry_serialization() {
        let entry = FileEntry {
            name: "test.txt".to_string(),
            path: "/path/to/test.txt".to_string(),
            is_dir: false,
            is_file: true,
            is_symlink: false,
            size: Some(1024),
            modified: Some(1234567890),
        };

        let json = serde_json::to_string(&entry).expect("Should serialize");
        assert!(json.contains("test.txt"));
        assert!(json.contains("1024"));
    }

    #[test]
    fn test_file_entry_deserialization() {
        let json = r#"{
            "name": "file.rs",
            "path": "/src/file.rs",
            "is_dir": false,
            "is_file": true,
            "is_symlink": false,
            "size": 2048,
            "modified": 1234567890
        }"#;

        let entry: FileEntry = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(entry.name, "file.rs");
        assert_eq!(entry.path, "/src/file.rs");
        assert!(!entry.is_dir);
        assert!(entry.is_file);
        assert_eq!(entry.size, Some(2048));
    }

    #[test]
    fn test_file_entry_directory() {
        let entry = FileEntry {
            name: "src".to_string(),
            path: "/project/src".to_string(),
            is_dir: true,
            is_file: false,
            is_symlink: false,
            size: None,
            modified: None,
        };

        assert!(entry.is_dir);
        assert!(!entry.is_file);
        assert!(entry.size.is_none());
    }

    #[test]
    fn test_file_entry_symlink() {
        let entry = FileEntry {
            name: "link".to_string(),
            path: "/project/link".to_string(),
            is_dir: false,
            is_file: false,
            is_symlink: true,
            size: None,
            modified: None,
        };

        assert!(entry.is_symlink);
        assert!(!entry.is_dir);
        assert!(!entry.is_file);
    }

    #[test]
    fn test_file_entry_clone() {
        let entry = FileEntry {
            name: "clone.txt".to_string(),
            path: "/test/clone.txt".to_string(),
            is_dir: false,
            is_file: true,
            is_symlink: false,
            size: Some(512),
            modified: Some(9876543210),
        };

        let cloned = entry.clone();
        assert_eq!(cloned.name, entry.name);
        assert_eq!(cloned.path, entry.path);
        assert_eq!(cloned.size, entry.size);
    }

    // ==================== FileWatchEvent Tests ====================

    #[test]
    fn test_file_watch_event_serialization() {
        let event = FileWatchEvent {
            watch_id: "watch-123".to_string(),
            path: "/watched/file.txt".to_string(),
            kind: "modify".to_string(),
        };

        let json = serde_json::to_string(&event).expect("Should serialize");
        assert!(json.contains("watch-123"));
        assert!(json.contains("modify"));
    }

    #[test]
    fn test_file_watch_event_deserialization() {
        let json = r#"{
            "watch_id": "abc-def",
            "path": "/some/path",
            "kind": "create"
        }"#;

        let event: FileWatchEvent = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(event.watch_id, "abc-def");
        assert_eq!(event.kind, "create");
    }

    #[test]
    fn test_file_watch_event_kinds() {
        let kinds = vec!["create", "modify", "delete", "rename"];
        for kind in kinds {
            let event = FileWatchEvent {
                watch_id: "test".to_string(),
                path: "/test".to_string(),
                kind: kind.to_string(),
            };
            assert_eq!(event.kind, kind);
        }
    }

    #[test]
    fn test_file_watch_event_clone() {
        let event = FileWatchEvent {
            watch_id: "original".to_string(),
            path: "/original/path".to_string(),
            kind: "delete".to_string(),
        };

        let cloned = event.clone();
        assert_eq!(cloned.watch_id, event.watch_id);
        assert_eq!(cloned.path, event.path);
        assert_eq!(cloned.kind, event.kind);
    }

    // ==================== FileStats Tests ====================

    #[test]
    fn test_file_stats_serialization() {
        let stats = FileStats {
            modified: Some(1609459200),
            size: 4096,
        };

        let json = serde_json::to_string(&stats).expect("Should serialize");
        assert!(json.contains("1609459200"));
        assert!(json.contains("4096"));
    }

    #[test]
    fn test_file_stats_deserialization() {
        let json = r#"{"modified": 1609459200, "size": 8192}"#;

        let stats: FileStats = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(stats.modified, Some(1609459200));
        assert_eq!(stats.size, 8192);
    }

    #[test]
    fn test_file_stats_no_modified() {
        let stats = FileStats {
            modified: None,
            size: 1024,
        };

        let json = serde_json::to_string(&stats).expect("Should serialize");
        let deserialized: FileStats = serde_json::from_str(&json).expect("Should deserialize");
        assert!(deserialized.modified.is_none());
        assert_eq!(deserialized.size, 1024);
    }

    #[test]
    fn test_file_stats_clone() {
        let stats = FileStats {
            modified: Some(12345),
            size: 999,
        };

        let cloned = stats.clone();
        assert_eq!(cloned.modified, stats.modified);
        assert_eq!(cloned.size, stats.size);
    }

    // ==================== FileWatchState Tests ====================

    #[test]
    fn test_file_watch_state_new() {
        let state = FileWatchState::new();
        let watchers = state.watchers.lock().unwrap();
        assert!(watchers.is_empty());
    }

    #[test]
    fn test_file_watch_state_thread_safety() {
        use std::sync::Arc;
        use std::thread;

        let state = Arc::new(FileWatchState::new());
        let mut handles = vec![];

        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                let watchers = state_clone.watchers.lock().unwrap();
                // Just verify we can acquire the lock
                let _ = watchers.len();
                i
            }));
        }

        for handle in handles {
            handle.join().expect("Thread should complete");
        }
    }

    // ==================== Sorting Logic Tests ====================

    #[test]
    fn test_file_entry_sorting_dirs_first() {
        let mut entries = vec![
            FileEntry {
                name: "file.txt".to_string(),
                path: "/file.txt".to_string(),
                is_dir: false,
                is_file: true,
                is_symlink: false,
                size: Some(100),
                modified: None,
            },
            FileEntry {
                name: "src".to_string(),
                path: "/src".to_string(),
                is_dir: true,
                is_file: false,
                is_symlink: false,
                size: None,
                modified: None,
            },
            FileEntry {
                name: "README.md".to_string(),
                path: "/README.md".to_string(),
                is_dir: false,
                is_file: true,
                is_symlink: false,
                size: Some(200),
                modified: None,
            },
        ];

        // Apply the same sorting logic as list_directory
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        assert!(entries[0].is_dir, "Directory should be first");
        assert_eq!(entries[0].name, "src");
        assert_eq!(entries[1].name, "file.txt"); // 'f' before 'R' case-insensitive
        assert_eq!(entries[2].name, "README.md");
    }

    #[test]
    fn test_file_entry_sorting_alphabetical() {
        let mut entries = vec![
            FileEntry {
                name: "zebra.txt".to_string(),
                path: "/zebra.txt".to_string(),
                is_dir: false,
                is_file: true,
                is_symlink: false,
                size: None,
                modified: None,
            },
            FileEntry {
                name: "Apple.txt".to_string(),
                path: "/Apple.txt".to_string(),
                is_dir: false,
                is_file: true,
                is_symlink: false,
                size: None,
                modified: None,
            },
            FileEntry {
                name: "banana.txt".to_string(),
                path: "/banana.txt".to_string(),
                is_dir: false,
                is_file: true,
                is_symlink: false,
                size: None,
                modified: None,
            },
        ];

        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        assert_eq!(entries[0].name, "Apple.txt");
        assert_eq!(entries[1].name, "banana.txt");
        assert_eq!(entries[2].name, "zebra.txt");
    }

    // ==================== Integration-like Tests ====================

    #[tokio::test]
    async fn test_read_file_nonexistent() {
        let result = read_file("/nonexistent/path/file.txt".to_string(), None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[tokio::test]
    async fn test_list_directory_nonexistent() {
        let result = list_directory("/nonexistent/directory".to_string(), None, None).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read directory"));
    }

    #[tokio::test]
    async fn test_get_file_stats_nonexistent() {
        let result = get_file_stats("/nonexistent/file.txt".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to get file stats"));
    }

    #[tokio::test]
    async fn test_read_file_real() {
        // Read a file we know exists
        let result = read_file(
            std::env::current_dir()
                .unwrap()
                .join("Cargo.toml")
                .to_string_lossy()
                .to_string(),
            None,
        )
        .await;

        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.contains("[package]"));
    }

    #[tokio::test]
    async fn test_list_directory_real() {
        let result = list_directory(
            std::env::current_dir().unwrap().to_string_lossy().to_string(),
            None,
            Some(false),
        )
        .await;

        assert!(result.is_ok());
        let entries = result.unwrap();
        assert!(!entries.is_empty());

        // Should contain Cargo.toml
        assert!(entries.iter().any(|e| e.name == "Cargo.toml"));
    }

    #[tokio::test]
    async fn test_list_directory_hidden_files() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let hidden_file = temp_dir.path().join(".hidden");
        let normal_file = temp_dir.path().join("normal.txt");

        std::fs::write(&hidden_file, "hidden").unwrap();
        std::fs::write(&normal_file, "normal").unwrap();

        // Without hidden files
        let result = list_directory(
            temp_dir.path().to_string_lossy().to_string(),
            None,
            Some(false),
        )
        .await
        .unwrap();

        assert!(!result.iter().any(|e| e.name == ".hidden"));
        assert!(result.iter().any(|e| e.name == "normal.txt"));

        // With hidden files
        let result_with_hidden = list_directory(
            temp_dir.path().to_string_lossy().to_string(),
            None,
            Some(true),
        )
        .await
        .unwrap();

        assert!(result_with_hidden.iter().any(|e| e.name == ".hidden"));
        assert!(result_with_hidden.iter().any(|e| e.name == "normal.txt"));
    }

    #[tokio::test]
    async fn test_write_file_and_read() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test_write.txt");
        let content = "Hello, World!";

        // Write file
        let write_result = write_file(
            file_path.to_string_lossy().to_string(),
            content.to_string(),
            None,
        )
        .await;
        assert!(write_result.is_ok());

        // Read it back
        let read_result = read_file(file_path.to_string_lossy().to_string(), None).await;
        assert!(read_result.is_ok());
        assert_eq!(read_result.unwrap(), content);
    }

    #[tokio::test]
    async fn test_write_file_create_dirs() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let nested_path = temp_dir.path().join("a").join("b").join("c").join("file.txt");

        let result = write_file(
            nested_path.to_string_lossy().to_string(),
            "nested content".to_string(),
            Some(true),
        )
        .await;

        assert!(result.is_ok());
        assert!(nested_path.exists());
    }

    #[tokio::test]
    async fn test_get_file_stats_real() {
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("stats_test.txt");
        let content = "Test content for stats";

        std::fs::write(&file_path, content).unwrap();

        let result = get_file_stats(file_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let stats = result.unwrap();
        assert_eq!(stats.size, content.len() as u64);
        assert!(stats.modified.is_some());
    }
}
