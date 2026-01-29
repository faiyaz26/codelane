//! Lane Management Module
//!
//! This module handles the creation, persistence, and management of lanes.
//! A lane represents a project workspace with its own terminal and AI agents.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

/// Represents a lane (project workspace)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lane {
    pub id: String,
    pub name: String,
    pub working_dir: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Lane {
    /// Creates a new lane with a unique ID and timestamps
    pub fn new(name: String, working_dir: String) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            working_dir,
            created_at: now,
            updated_at: now,
        }
    }

    /// Updates the lane and refreshes the updated_at timestamp
    pub fn update(&mut self, name: Option<String>, working_dir: Option<String>) {
        if let Some(n) = name {
            self.name = n;
        }
        if let Some(wd) = working_dir {
            self.working_dir = wd;
        }
        self.updated_at = chrono::Utc::now().timestamp();
    }
}

/// State management for lanes
pub struct LaneState {
    lanes: Mutex<HashMap<String, Lane>>,
    storage_dir: PathBuf,
}

impl LaneState {
    /// Creates a new LaneState and initializes the storage directory
    pub fn new() -> Self {
        let storage_dir = dirs::home_dir()
            .expect("Could not find home directory")
            .join(".codelane")
            .join("lanes");

        // Create the storage directory if it doesn't exist
        fs::create_dir_all(&storage_dir)
            .expect("Failed to create lanes storage directory");

        let mut state = Self {
            lanes: Mutex::new(HashMap::new()),
            storage_dir,
        };

        // Load existing lanes from disk
        state.load_lanes();
        state
    }

    /// Loads all lanes from the storage directory
    fn load_lanes(&mut self) {
        if let Ok(entries) = fs::read_dir(&self.storage_dir) {
            let mut lanes = self.lanes.lock().unwrap();
            for entry in entries.flatten() {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(lane) = serde_json::from_str::<Lane>(&content) {
                        lanes.insert(lane.id.clone(), lane);
                    }
                }
            }
        }
    }

    /// Saves a lane to disk
    fn save_lane(&self, lane: &Lane) -> Result<(), String> {
        let file_path = self.storage_dir.join(format!("{}.json", lane.id));
        let content = serde_json::to_string_pretty(lane)
            .map_err(|e| format!("Failed to serialize lane: {}", e))?;

        fs::write(file_path, content)
            .map_err(|e| format!("Failed to write lane file: {}", e))?;

        Ok(())
    }

    /// Deletes a lane file from disk
    fn delete_lane_file(&self, lane_id: &str) -> Result<(), String> {
        let file_path = self.storage_dir.join(format!("{}.json", lane_id));
        if file_path.exists() {
            fs::remove_file(file_path)
                .map_err(|e| format!("Failed to delete lane file: {}", e))?;
        }
        Ok(())
    }
}

/// Creates a new lane
#[tauri::command]
pub fn lane_create(
    name: String,
    working_dir: String,
    state: State<LaneState>,
) -> Result<Lane, String> {
    // Validate working directory exists
    let path = PathBuf::from(&working_dir);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Working directory does not exist: {}", working_dir));
    }

    let lane = Lane::new(name, working_dir);

    // Save to disk
    state.save_lane(&lane)?;

    // Store in memory
    let mut lanes = state.lanes.lock().unwrap();
    lanes.insert(lane.id.clone(), lane.clone());

    Ok(lane)
}

/// Lists all lanes
#[tauri::command]
pub fn lane_list(state: State<LaneState>) -> Result<Vec<Lane>, String> {
    let lanes = state.lanes.lock().unwrap();
    let mut lane_list: Vec<Lane> = lanes.values().cloned().collect();

    // Sort by updated_at (most recent first)
    lane_list.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(lane_list)
}

/// Gets a specific lane by ID
#[tauri::command]
pub fn lane_get(lane_id: String, state: State<LaneState>) -> Result<Lane, String> {
    let lanes = state.lanes.lock().unwrap();
    lanes
        .get(&lane_id)
        .cloned()
        .ok_or_else(|| format!("Lane not found: {}", lane_id))
}

/// Updates a lane
#[tauri::command]
pub fn lane_update(
    lane_id: String,
    name: Option<String>,
    working_dir: Option<String>,
    state: State<LaneState>,
) -> Result<Lane, String> {
    let mut lanes = state.lanes.lock().unwrap();

    let lane = lanes
        .get_mut(&lane_id)
        .ok_or_else(|| format!("Lane not found: {}", lane_id))?;

    // Validate new working directory if provided
    if let Some(ref wd) = working_dir {
        let path = PathBuf::from(wd);
        if !path.exists() || !path.is_dir() {
            return Err(format!("Working directory does not exist: {}", wd));
        }
    }

    lane.update(name, working_dir);

    // Save to disk
    state.save_lane(lane)?;

    Ok(lane.clone())
}

/// Deletes a lane
#[tauri::command]
pub fn lane_delete(lane_id: String, state: State<LaneState>) -> Result<(), String> {
    let mut lanes = state.lanes.lock().unwrap();

    if lanes.remove(&lane_id).is_none() {
        return Err(format!("Lane not found: {}", lane_id));
    }

    // Delete from disk
    state.delete_lane_file(&lane_id)?;

    Ok(())
}
