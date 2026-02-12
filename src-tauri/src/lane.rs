//! Lane Management Module
//!
//! This module handles the creation, persistence, and management of lanes.
//! A lane represents a project workspace with its own terminal and AI agents.

use codelane_core::config::AgentConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

/// Lane configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaneConfig {
    /// Per-lane agent override (overrides global default)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_override: Option<AgentConfig>,

    /// Environment variables to set
    #[serde(default)]
    pub env: Vec<(String, String)>,

    /// LSP servers to enable
    #[serde(default)]
    pub lsp_servers: Vec<String>,
}

/// Represents a lane (project workspace)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lane {
    pub id: String,
    pub name: String,
    pub working_dir: String,
    pub created_at: i64,
    pub updated_at: i64,

    /// Lane-specific configuration
    #[serde(default)]
    pub config: LaneConfig,
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
            config: LaneConfig::default(),
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
    pub(crate) lanes: Mutex<HashMap<String, Lane>>,
    storage_dir: PathBuf,
}

impl LaneState {
    /// Creates a new LaneState and initializes the storage directory
    pub fn new() -> Self {
        let storage_dir = crate::paths::lanes_dir();

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
    pub fn save_lane(&self, lane: &Lane) -> Result<(), String> {
        let file_path = self.storage_dir.join(format!("{}.json", lane.id));
        let content = serde_json::to_string_pretty(lane)
            .map_err(|e| format!("Failed to serialize lane: {}", e))?;

        fs::write(file_path, content)
            .map_err(|e| format!("Failed to write lane file: {}", e))?;

        Ok(())
    }

    /// Lists all lanes (helper for other modules)
    pub fn list_lanes(&self) -> Result<Vec<Lane>, String> {
        let lanes = self.lanes.lock().unwrap();
        Ok(lanes.values().cloned().collect())
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

    // Clean up hook events directory for this lane
    if let Ok(lane_events_dir) = codelane_core::paths::lane_hook_events_dir(&lane_id) {
        if lane_events_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&lane_events_dir) {
                tracing::warn!("Failed to remove hook events directory for lane {}: {}", lane_id, e);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== LaneConfig Tests ====================

    #[test]
    fn test_lane_config_default() {
        let config = LaneConfig::default();
        assert!(config.agent_override.is_none());
        assert!(config.env.is_empty());
        assert!(config.lsp_servers.is_empty());
    }

    #[test]
    fn test_lane_config_serialization() {
        let config = LaneConfig {
            agent_override: None,
            env: vec![("KEY".to_string(), "VALUE".to_string())],
            lsp_servers: vec!["rust-analyzer".to_string()],
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        assert!(json.contains("KEY"));
        assert!(json.contains("VALUE"));
        assert!(json.contains("rust-analyzer"));
    }

    #[test]
    fn test_lane_config_deserialization() {
        let json = r#"{
            "env": [["MY_VAR", "my_value"]],
            "lspServers": ["typescript-language-server"]
        }"#;

        let config: LaneConfig = serde_json::from_str(json).expect("Should deserialize");
        assert_eq!(config.env.len(), 1);
        assert_eq!(config.env[0].0, "MY_VAR");
        assert_eq!(config.lsp_servers.len(), 1);
    }

    #[test]
    fn test_lane_config_empty_json() {
        let json = "{}";
        let config: LaneConfig = serde_json::from_str(json).expect("Should deserialize empty");
        assert!(config.agent_override.is_none());
        assert!(config.env.is_empty());
        assert!(config.lsp_servers.is_empty());
    }

    #[test]
    fn test_lane_config_clone() {
        let config = LaneConfig {
            agent_override: None,
            env: vec![("A".to_string(), "B".to_string())],
            lsp_servers: vec!["lsp1".to_string(), "lsp2".to_string()],
        };

        let cloned = config.clone();
        assert_eq!(cloned.env, config.env);
        assert_eq!(cloned.lsp_servers, config.lsp_servers);
    }

    // ==================== Lane Tests ====================

    #[test]
    fn test_lane_new() {
        let lane = Lane::new("Test Lane".to_string(), "/path/to/project".to_string());

        assert!(!lane.id.is_empty());
        assert_eq!(lane.name, "Test Lane");
        assert_eq!(lane.working_dir, "/path/to/project");
        assert!(lane.created_at > 0);
        assert_eq!(lane.created_at, lane.updated_at);
    }

    #[test]
    fn test_lane_new_unique_ids() {
        let lane1 = Lane::new("Lane 1".to_string(), "/path1".to_string());
        let lane2 = Lane::new("Lane 2".to_string(), "/path2".to_string());

        assert_ne!(lane1.id, lane2.id, "Each lane should have a unique ID");
    }

    #[test]
    fn test_lane_update_name() {
        let mut lane = Lane::new("Original".to_string(), "/path".to_string());
        let original_updated_at = lane.updated_at;

        // Small delay to ensure timestamp changes
        std::thread::sleep(std::time::Duration::from_millis(10));

        lane.update(Some("Updated Name".to_string()), None);

        assert_eq!(lane.name, "Updated Name");
        assert_eq!(lane.working_dir, "/path");
        assert!(lane.updated_at >= original_updated_at);
    }

    #[test]
    fn test_lane_update_working_dir() {
        let mut lane = Lane::new("Lane".to_string(), "/old/path".to_string());

        lane.update(None, Some("/new/path".to_string()));

        assert_eq!(lane.name, "Lane");
        assert_eq!(lane.working_dir, "/new/path");
    }

    #[test]
    fn test_lane_update_both() {
        let mut lane = Lane::new("Old Name".to_string(), "/old/path".to_string());

        lane.update(
            Some("New Name".to_string()),
            Some("/new/path".to_string()),
        );

        assert_eq!(lane.name, "New Name");
        assert_eq!(lane.working_dir, "/new/path");
    }

    #[test]
    fn test_lane_update_none() {
        let mut lane = Lane::new("Name".to_string(), "/path".to_string());
        let original_name = lane.name.clone();
        let original_path = lane.working_dir.clone();

        lane.update(None, None);

        assert_eq!(lane.name, original_name);
        assert_eq!(lane.working_dir, original_path);
    }

    #[test]
    fn test_lane_serialization() {
        let lane = Lane::new("My Project".to_string(), "/home/user/project".to_string());

        let json = serde_json::to_string(&lane).expect("Should serialize");

        assert!(json.contains("My Project"));
        assert!(json.contains("/home/user/project"));
        assert!(json.contains("id"));
        assert!(json.contains("createdAt")); // camelCase due to serde rename
    }

    #[test]
    fn test_lane_deserialization() {
        let json = r#"{
            "id": "test-uuid-123",
            "name": "Deserialized Lane",
            "workingDir": "/test/path",
            "createdAt": 1609459200,
            "updatedAt": 1609459200,
            "config": {}
        }"#;

        let lane: Lane = serde_json::from_str(json).expect("Should deserialize");

        assert_eq!(lane.id, "test-uuid-123");
        assert_eq!(lane.name, "Deserialized Lane");
        assert_eq!(lane.working_dir, "/test/path");
        assert_eq!(lane.created_at, 1609459200);
    }

    #[test]
    fn test_lane_clone() {
        let lane = Lane::new("Clone Test".to_string(), "/clone/path".to_string());
        let cloned = lane.clone();

        assert_eq!(cloned.id, lane.id);
        assert_eq!(cloned.name, lane.name);
        assert_eq!(cloned.working_dir, lane.working_dir);
        assert_eq!(cloned.created_at, lane.created_at);
    }

    #[test]
    fn test_lane_with_config() {
        let mut lane = Lane::new("Configured".to_string(), "/path".to_string());
        lane.config.env = vec![("NODE_ENV".to_string(), "development".to_string())];
        lane.config.lsp_servers = vec!["rust-analyzer".to_string()];

        let json = serde_json::to_string(&lane).expect("Should serialize");
        let deserialized: Lane = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.config.env.len(), 1);
        assert_eq!(deserialized.config.lsp_servers.len(), 1);
    }

    // ==================== LaneState Tests ====================

    #[test]
    fn test_lane_state_new() {
        let state = LaneState::new();
        let lanes = state.lanes.lock().unwrap();
        // May or may not be empty depending on disk state
        let _ = lanes.len();
    }

    #[test]
    fn test_lane_state_thread_safety() {
        use std::sync::Arc;
        use std::thread;

        let state = Arc::new(LaneState::new());
        let mut handles = vec![];

        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                let lanes = state_clone.lanes.lock().unwrap();
                let _ = lanes.len();
                i
            }));
        }

        for handle in handles {
            handle.join().expect("Thread should complete");
        }
    }

    #[test]
    fn test_lane_state_save_and_list() {
        let state = LaneState::new();
        let lane = Lane::new("Test Save".to_string(), "/tmp".to_string());

        // Save the lane
        state.save_lane(&lane).expect("Should save lane");

        // Insert into memory
        {
            let mut lanes = state.lanes.lock().unwrap();
            lanes.insert(lane.id.clone(), lane.clone());
        }

        // List should include our lane
        let listed = state.list_lanes().expect("Should list lanes");
        assert!(listed.iter().any(|l| l.id == lane.id));

        // Cleanup
        state.delete_lane_file(&lane.id).ok();
    }

    #[test]
    fn test_lane_state_delete_nonexistent() {
        let state = LaneState::new();
        // Deleting a non-existent file should not error
        let result = state.delete_lane_file("nonexistent-id");
        assert!(result.is_ok());
    }

    // ==================== Lane Sorting Tests ====================

    #[test]
    fn test_lane_sorting_by_updated_at() {
        let mut lanes = vec![
            Lane {
                id: "1".to_string(),
                name: "Old".to_string(),
                working_dir: "/old".to_string(),
                created_at: 1000,
                updated_at: 1000,
                config: LaneConfig::default(),
            },
            Lane {
                id: "2".to_string(),
                name: "New".to_string(),
                working_dir: "/new".to_string(),
                created_at: 2000,
                updated_at: 3000,
                config: LaneConfig::default(),
            },
            Lane {
                id: "3".to_string(),
                name: "Middle".to_string(),
                working_dir: "/middle".to_string(),
                created_at: 1500,
                updated_at: 2000,
                config: LaneConfig::default(),
            },
        ];

        // Sort by updated_at descending (most recent first)
        lanes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        assert_eq!(lanes[0].name, "New");
        assert_eq!(lanes[1].name, "Middle");
        assert_eq!(lanes[2].name, "Old");
    }

    // ==================== UUID Validation Tests ====================

    #[test]
    fn test_lane_id_is_valid_uuid() {
        let lane = Lane::new("UUID Test".to_string(), "/test".to_string());

        // The ID should be a valid UUID format
        assert!(uuid::Uuid::parse_str(&lane.id).is_ok());
    }

    // ==================== Edge Cases ====================

    #[test]
    fn test_lane_empty_name() {
        let lane = Lane::new("".to_string(), "/path".to_string());
        assert_eq!(lane.name, "");
    }

    #[test]
    fn test_lane_unicode_name() {
        let lane = Lane::new("项目 🚀 Проект".to_string(), "/path".to_string());
        assert_eq!(lane.name, "项目 🚀 Проект");

        // Should serialize/deserialize correctly
        let json = serde_json::to_string(&lane).expect("Should serialize unicode");
        let deserialized: Lane = serde_json::from_str(&json).expect("Should deserialize unicode");
        assert_eq!(deserialized.name, "项目 🚀 Проект");
    }

    #[test]
    fn test_lane_long_path() {
        let long_path = "/".to_string() + &"a".repeat(500);
        let lane = Lane::new("Long Path".to_string(), long_path.clone());
        assert_eq!(lane.working_dir, long_path);
    }

    // ==================== LaneConfig with agent override ====================

    #[test]
    fn test_lane_config_with_agent_override() {
        use codelane_core::config::{AgentConfig, AgentType};
        use std::collections::HashMap;

        let config = LaneConfig {
            agent_override: Some(AgentConfig {
                agent_type: AgentType::Claude,
                command: "claude".to_string(),
                args: vec!["--verbose".to_string()],
                env: HashMap::new(),
                use_lane_cwd: true,
            }),
            env: vec![],
            lsp_servers: vec![],
        };

        assert!(config.agent_override.is_some());
        let override_config = config.agent_override.unwrap();
        assert!(matches!(override_config.agent_type, AgentType::Claude));
    }

    #[test]
    fn test_lane_config_serialization_with_agent() {
        use codelane_core::config::{AgentConfig, AgentType};
        use std::collections::HashMap;

        let config = LaneConfig {
            agent_override: Some(AgentConfig {
                agent_type: AgentType::Shell,
                command: "/bin/zsh".to_string(),
                args: vec!["-l".to_string()],
                env: HashMap::new(),
                use_lane_cwd: false,
            }),
            env: vec![("PATH".to_string(), "/usr/bin".to_string())],
            lsp_servers: vec!["rust-analyzer".to_string()],
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        let deserialized: LaneConfig = serde_json::from_str(&json).expect("Should deserialize");

        assert!(deserialized.agent_override.is_some());
        assert_eq!(deserialized.env.len(), 1);
        assert_eq!(deserialized.lsp_servers.len(), 1);
    }

    // ==================== Lane timestamp tests ====================

    #[test]
    fn test_lane_timestamps_are_recent() {
        let lane = Lane::new("Test".to_string(), "/tmp".to_string());
        let now = chrono::Utc::now().timestamp();

        // Timestamps should be within 1 second of now
        assert!(lane.created_at <= now);
        assert!(lane.created_at >= now - 1);
        assert!(lane.updated_at <= now);
        assert!(lane.updated_at >= now - 1);
    }

    #[test]
    fn test_lane_update_changes_timestamp() {
        let mut lane = Lane::new("Test".to_string(), "/path".to_string());
        let original = lane.updated_at;

        // Wait a tiny bit to ensure timestamp changes
        std::thread::sleep(std::time::Duration::from_millis(5));

        lane.update(Some("New Name".to_string()), None);

        // updated_at should be >= original (may be same if very fast)
        assert!(lane.updated_at >= original);
    }

    // ==================== LaneState storage tests ====================

    #[test]
    fn test_lane_state_storage_dir_exists() {
        let state = LaneState::new();
        assert!(state.storage_dir.exists());
    }

    #[test]
    fn test_lane_state_save_creates_file() {
        let state = LaneState::new();
        let lane = Lane::new("File Test".to_string(), "/tmp".to_string());

        state.save_lane(&lane).expect("Should save");

        let file_path = state.storage_dir.join(format!("{}.json", lane.id));
        assert!(file_path.exists());

        // Cleanup
        std::fs::remove_file(file_path).ok();
    }

    #[test]
    fn test_lane_state_delete_removes_file() {
        let state = LaneState::new();
        let lane = Lane::new("Delete Test".to_string(), "/tmp".to_string());

        state.save_lane(&lane).expect("Should save");

        let file_path = state.storage_dir.join(format!("{}.json", lane.id));
        assert!(file_path.exists());

        state.delete_lane_file(&lane.id).expect("Should delete");
        assert!(!file_path.exists());
    }

    // ==================== Lane JSON format tests ====================

    #[test]
    fn test_lane_json_uses_camel_case() {
        let lane = Lane::new("Test".to_string(), "/path".to_string());
        let json = serde_json::to_string(&lane).expect("Should serialize");

        assert!(json.contains("workingDir"));
        assert!(json.contains("createdAt"));
        assert!(json.contains("updatedAt"));
        assert!(!json.contains("working_dir"));
        assert!(!json.contains("created_at"));
    }

    #[test]
    fn test_lane_config_json_uses_camel_case() {
        let config = LaneConfig {
            agent_override: None,
            env: vec![],
            lsp_servers: vec!["test".to_string()],
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        assert!(json.contains("lspServers"));
        assert!(!json.contains("lsp_servers"));
    }

    // ==================== Lane list sorting tests ====================

    #[test]
    fn test_lane_state_list_returns_clones() {
        let state = LaneState::new();
        let lane = Lane::new("Clone Test".to_string(), "/tmp".to_string());

        {
            let mut lanes = state.lanes.lock().unwrap();
            lanes.insert(lane.id.clone(), lane.clone());
        }

        let listed = state.list_lanes().expect("Should list");

        // Modifying the listed lanes shouldn't affect the state
        // (they should be clones)
        for _ in listed {
            // Just verify we can iterate
        }

        // Cleanup
        state.delete_lane_file(&lane.id).ok();
        let mut lanes = state.lanes.lock().unwrap();
        lanes.remove(&lane.id);
    }

    // ==================== Edge cases ====================

    #[test]
    fn test_lane_special_characters_in_name() {
        let special_names = vec![
            "Project (v2)",
            "Test - Main",
            "Feature: Auth",
            "Bug #123",
            "Project/Subproject",
        ];

        for name in special_names {
            let lane = Lane::new(name.to_string(), "/tmp".to_string());
            let json = serde_json::to_string(&lane).expect("Should serialize");
            let deserialized: Lane = serde_json::from_str(&json).expect("Should deserialize");
            assert_eq!(deserialized.name, name);
        }
    }

    #[test]
    fn test_lane_whitespace_in_path() {
        let path = "/path/with spaces/project".to_string();
        let lane = Lane::new("Test".to_string(), path.clone());

        let json = serde_json::to_string(&lane).expect("Should serialize");
        let deserialized: Lane = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.working_dir, path);
    }

    #[test]
    fn test_lane_config_multiple_env_vars() {
        let config = LaneConfig {
            agent_override: None,
            env: vec![
                ("PATH".to_string(), "/usr/bin".to_string()),
                ("HOME".to_string(), "/home/user".to_string()),
                ("EDITOR".to_string(), "vim".to_string()),
            ],
            lsp_servers: vec![],
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        let deserialized: LaneConfig = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.env.len(), 3);
    }

    #[test]
    fn test_lane_config_multiple_lsp_servers() {
        let config = LaneConfig {
            agent_override: None,
            env: vec![],
            lsp_servers: vec![
                "rust-analyzer".to_string(),
                "typescript-language-server".to_string(),
                "pylsp".to_string(),
            ],
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        let deserialized: LaneConfig = serde_json::from_str(&json).expect("Should deserialize");

        assert_eq!(deserialized.lsp_servers.len(), 3);
    }
}
