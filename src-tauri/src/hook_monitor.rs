//! Hook event monitoring service.
//!
//! Watches hook event directories for each lane and emits events to the frontend
//! when hook scripts write event JSON files.

use codelane_core::hooks::HookEvent;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// State for hook event monitoring
pub struct HookMonitorState {
    watchers: Mutex<HashMap<String, RecommendedWatcher>>,
}

impl HookMonitorState {
    /// Create new hook monitor state
    pub fn new() -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
        }
    }

    /// Clean up old hook event files and empty lane directories
    pub fn cleanup_old_events(max_age_hours: u64) -> Result<(), String> {
        let hook_events_dir = codelane_core::paths::hook_events_dir()
            .map_err(|e| format!("Failed to get hook events dir: {}", e))?;

        if !hook_events_dir.exists() {
            return Ok(());
        }

        let max_age = std::time::Duration::from_secs(max_age_hours * 3600);
        let now = std::time::SystemTime::now();
        let mut cleaned_count = 0;

        // Iterate through lane directories
        let entries = std::fs::read_dir(&hook_events_dir)
            .map_err(|e| format!("Failed to read hook events directory: {}", e))?;

        for entry in entries.flatten() {
            let lane_dir = entry.path();
            if !lane_dir.is_dir() {
                continue;
            }

            // Clean up old event files in this lane directory
            if let Ok(event_entries) = std::fs::read_dir(&lane_dir) {
                for event_entry in event_entries.flatten() {
                    let event_file = event_entry.path();
                    if event_file.extension().and_then(|s| s.to_str()) != Some("json") {
                        continue;
                    }

                    // Check file age
                    if let Ok(metadata) = std::fs::metadata(&event_file) {
                        if let Ok(modified) = metadata.modified() {
                            if let Ok(age) = now.duration_since(modified) {
                                if age > max_age {
                                    if std::fs::remove_file(&event_file).is_ok() {
                                        cleaned_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Remove empty lane directories
            if let Ok(entries) = std::fs::read_dir(&lane_dir) {
                if entries.count() == 0 {
                    let _ = std::fs::remove_dir(&lane_dir);
                }
            }
        }

        if cleaned_count > 0 {
            tracing::info!("Cleaned up {} old hook event files", cleaned_count);
        }

        Ok(())
    }

    /// Start monitoring hook events for a lane
    pub fn start_monitoring(&self, lane_id: String, app: AppHandle) -> Result<(), String> {
        // Get the lane's hook events directory
        let events_dir = codelane_core::paths::lane_hook_events_dir(&lane_id)
            .map_err(|e| format!("Failed to get hook events directory: {}", e))?;

        tracing::info!("Starting hook monitor for lane {} at {:?}", lane_id, events_dir);

        let (tx, rx) = mpsc::channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to create file watcher: {}", e))?;

        watcher
            .watch(&events_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        // Store watcher
        {
            let mut watchers = self
                .watchers
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            watchers.insert(lane_id.clone(), watcher);
        }

        // Spawn thread to handle events
        std::thread::Builder::new()
            .name(format!("hook-monitor-{}", &lane_id[..8.min(lane_id.len())]))
            .spawn(move || {
                while let Ok(result) = rx.recv() {
                    if let Ok(event) = result {
                        handle_file_event(event, &app);
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn monitoring thread: {}", e))?;

        Ok(())
    }

    /// Stop monitoring for a lane
    pub fn stop_monitoring(&self, lane_id: &str) {
        if let Ok(mut watchers) = self.watchers.lock() {
            if watchers.remove(lane_id).is_some() {
                tracing::info!("Stopped hook monitor for lane {}", lane_id);
            }
        }
    }
}

/// Handle a file system event from the watcher
fn handle_file_event(event: Event, app: &AppHandle) {
    // Only process Create events (new event files)
    if !matches!(event.kind, notify::EventKind::Create(_)) {
        return;
    }

    for path in event.paths {
        // Only process .json files
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        // Read and parse event file
        match std::fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<HookEvent>(&content) {
                Ok(hook_event) => {
                    tracing::info!(
                        "Hook event received: lane={}, agent={}, type={:?}",
                        hook_event.lane_id,
                        hook_event.agent_type,
                        hook_event.event_type
                    );

                    // Emit to frontend
                    if let Err(e) = app.emit("hook-event", &hook_event) {
                        tracing::error!("Failed to emit hook event: {}", e);
                    }

                    // Clean up processed event file
                    if let Err(e) = std::fs::remove_file(&path) {
                        tracing::warn!("Failed to remove processed event file {:?}: {}", path, e);
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to parse hook event JSON {:?}: {}", path, e);
                    // Remove invalid file
                    let _ = std::fs::remove_file(&path);
                }
            },
            Err(e) => {
                tracing::error!("Failed to read hook event file {:?}: {}", path, e);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_monitor_state_creation() {
        let state = HookMonitorState::new();
        let watchers = state.watchers.lock().unwrap();
        assert_eq!(watchers.len(), 0);
    }
}
