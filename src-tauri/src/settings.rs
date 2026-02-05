//! Settings management for Codelane
//!
//! Handles global application settings including agent configurations.

use codelane_core::config::{AgentConfig, AgentSettings};
use std::sync::Mutex;
use std::process::Command;
use tauri::State;

/// Global settings state
pub struct SettingsState {
    agent_settings: Mutex<AgentSettings>,
}

impl SettingsState {
    /// Create a new settings state, loading from disk if available
    pub fn new() -> Self {
        let agent_settings = AgentSettings::load().unwrap_or_default();
        Self {
            agent_settings: Mutex::new(agent_settings),
        }
    }

    /// Get the current agent settings
    pub fn get_agent_settings(&self) -> Result<AgentSettings, String> {
        self.agent_settings
            .lock()
            .map(|settings| settings.clone())
            .map_err(|e| format!("Failed to lock agent settings: {}", e))
    }

    /// Update agent settings and persist to disk
    pub fn update_agent_settings(&self, new_settings: AgentSettings) -> Result<(), String> {
        let mut settings = self
            .agent_settings
            .lock()
            .map_err(|e| format!("Failed to lock agent settings: {}", e))?;

        *settings = new_settings.clone();

        // Persist to disk
        new_settings
            .save()
            .map_err(|e| format!("Failed to save agent settings: {}", e))?;

        Ok(())
    }
}

/// Get current agent settings
#[tauri::command]
pub fn settings_get_agents(state: State<SettingsState>) -> Result<AgentSettings, String> {
    state.get_agent_settings()
}

/// Update agent settings
#[tauri::command]
pub fn settings_update_agents(
    settings: AgentSettings,
    state: State<SettingsState>,
) -> Result<(), String> {
    state.update_agent_settings(settings)
}

/// Get the resolved agent config for a specific lane
/// Resolution order: lane override -> global default
#[tauri::command]
pub fn lane_get_agent_config(
    lane_id: String,
    lane_state: State<crate::lane::LaneState>,
    settings_state: State<SettingsState>,
) -> Result<AgentConfig, String> {
    let lanes = lane_state.list_lanes()?;
    let lane = lanes
        .iter()
        .find(|l| l.id == lane_id)
        .ok_or_else(|| format!("Lane not found: {}", lane_id))?;

    // Check for lane override first
    if let Some(override_config) = &lane.config.agent_override {
        return Ok(override_config.clone());
    }

    // Fall back to global default
    let agent_settings = settings_state.get_agent_settings()?;
    Ok(agent_settings.default_agent)
}

/// Update agent configuration for a specific lane
#[tauri::command]
pub fn lane_update_agent_config(
    lane_id: String,
    agent_config: Option<AgentConfig>,
    lane_state: State<crate::lane::LaneState>,
) -> Result<crate::lane::Lane, String> {
    // Get the lane from state
    let mut lanes_guard = lane_state
        .lanes
        .lock()
        .map_err(|e| format!("Failed to lock lanes: {}", e))?;

    let lane = lanes_guard
        .get_mut(&lane_id)
        .ok_or_else(|| format!("Lane not found: {}", lane_id))?;

    // Update the agent override
    lane.config.agent_override = agent_config;
    lane.updated_at = chrono::Utc::now().timestamp();

    // Save to disk
    let lane_clone = lane.clone();
    drop(lanes_guard); // Release the lock before saving

    lane_state.save_lane(&lane_clone)?;

    Ok(lane_clone)
}

/// Check if a command exists and return its full path
#[tauri::command]
pub fn check_command_exists(command: String) -> Result<Option<String>, String> {
    // Try to find the command using 'which' on Unix or 'where' on Windows
    #[cfg(unix)]
    let output = Command::new("which")
        .arg(&command)
        .output()
        .map_err(|e| format!("Failed to execute 'which': {}", e))?;

    #[cfg(windows)]
    let output = Command::new("where")
        .arg(&command)
        .output()
        .map_err(|e| format!("Failed to execute 'where': {}", e))?;

    if output.status.success() {
        let path = String::from_utf8(output.stdout)
            .map_err(|e| format!("Invalid UTF-8 in command output: {}", e))?
            .trim()
            .lines()
            .next() // Get first line (first match)
            .map(|s| s.to_string());
        Ok(path)
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ==================== SettingsState Tests ====================

    #[test]
    fn test_settings_state_new() {
        let state = SettingsState::new();
        // Should be able to get agent settings
        let result = state.get_agent_settings();
        assert!(result.is_ok());
    }

    #[test]
    fn test_settings_state_get_agent_settings() {
        let state = SettingsState::new();
        let settings = state.get_agent_settings().expect("Should get settings");

        // AgentSettings should have a default_agent
        let _ = settings.default_agent;
    }

    #[test]
    fn test_settings_state_thread_safety() {
        use std::sync::Arc;
        use std::thread;

        let state = Arc::new(SettingsState::new());
        let mut handles = vec![];

        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                let _ = state_clone.get_agent_settings();
                i
            }));
        }

        for handle in handles {
            handle.join().expect("Thread should complete");
        }
    }

    #[test]
    fn test_settings_state_update_and_get() {
        let state = SettingsState::new();

        // Get current settings
        let original = state.get_agent_settings().expect("Should get settings");

        // Update with the same settings (no-op but tests the flow)
        let update_result = state.update_agent_settings(original.clone());
        assert!(update_result.is_ok());

        // Verify we can still get settings
        let after_update = state.get_agent_settings().expect("Should get settings");
        assert_eq!(
            after_update.default_agent.agent_type,
            original.default_agent.agent_type
        );
    }

    // ==================== check_command_exists Tests ====================

    #[test]
    fn test_check_command_exists_ls() {
        // 'ls' should exist on Unix systems
        #[cfg(unix)]
        {
            let result = check_command_exists("ls".to_string());
            assert!(result.is_ok());
            let path = result.unwrap();
            assert!(path.is_some());
            assert!(path.unwrap().contains("ls"));
        }
    }

    #[test]
    fn test_check_command_exists_nonexistent() {
        let result = check_command_exists("this_command_definitely_does_not_exist_12345".to_string());
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_check_command_exists_git() {
        // 'git' is commonly installed
        let result = check_command_exists("git".to_string());
        assert!(result.is_ok());
        // May or may not be installed, so we just check it doesn't error
    }

    #[test]
    fn test_check_command_exists_cargo() {
        // 'cargo' should exist since we're running Rust tests
        let result = check_command_exists("cargo".to_string());
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.is_some(), "cargo should be installed");
    }

    #[test]
    fn test_check_command_exists_rustc() {
        // 'rustc' should exist since we're running Rust tests
        let result = check_command_exists("rustc".to_string());
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.is_some(), "rustc should be installed");
    }

    #[test]
    fn test_check_command_exists_empty_string() {
        let result = check_command_exists("".to_string());
        assert!(result.is_ok());
        // Empty string should not find anything
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_check_command_exists_with_path_separator() {
        // Command with path separator should be handled
        let result = check_command_exists("/usr/bin/ls".to_string());
        // This may or may not work depending on implementation
        assert!(result.is_ok());
    }

    // ==================== AgentConfig Integration Tests ====================

    #[test]
    fn test_agent_config_serialization() {
        use std::collections::HashMap;

        let config = AgentConfig {
            agent_type: codelane_core::config::AgentType::Claude,
            command: "claude".to_string(),
            args: vec!["--config".to_string(), "test".to_string()],
            env: HashMap::new(),
            use_lane_cwd: true,
        };

        let json = serde_json::to_string(&config).expect("Should serialize");
        assert!(json.contains("claude"));
        assert!(json.contains("agentType"));
    }

    #[test]
    fn test_agent_config_deserialization() {
        let json = r#"{
            "agentType": "claude",
            "command": "claude",
            "args": ["--verbose"],
            "env": {},
            "useLaneCwd": true
        }"#;

        let config: AgentConfig = serde_json::from_str(json).expect("Should deserialize");
        assert!(matches!(
            config.agent_type,
            codelane_core::config::AgentType::Claude
        ));
        assert_eq!(config.command, "claude".to_string());
        assert_eq!(config.args, vec!["--verbose"]);
    }

    #[test]
    fn test_agent_config_presets() {
        // Test the preset constructors
        let claude = AgentConfig::claude_preset();
        assert!(matches!(
            claude.agent_type,
            codelane_core::config::AgentType::Claude
        ));
        assert_eq!(claude.command, "claude");

        let shell = AgentConfig::shell_default();
        assert!(matches!(
            shell.agent_type,
            codelane_core::config::AgentType::Shell
        ));

        let cursor = AgentConfig::cursor_preset();
        assert!(matches!(
            cursor.agent_type,
            codelane_core::config::AgentType::Cursor
        ));

        let aider = AgentConfig::aider_preset();
        assert!(matches!(
            aider.agent_type,
            codelane_core::config::AgentType::Aider
        ));
    }

    #[test]
    fn test_agent_settings_serialization() {
        let settings = AgentSettings::default();
        let json = serde_json::to_string(&settings).expect("Should serialize");
        assert!(json.contains("defaultAgent"));
    }

    #[test]
    fn test_agent_settings_deserialization() {
        let json = r#"{
            "defaultAgent": {
                "agentType": "shell",
                "command": "/bin/bash",
                "args": [],
                "env": {},
                "useLaneCwd": true
            },
            "presets": {}
        }"#;

        let settings: AgentSettings = serde_json::from_str(json).expect("Should deserialize");
        assert!(matches!(
            settings.default_agent.agent_type,
            codelane_core::config::AgentType::Shell
        ));
    }

    #[test]
    fn test_agent_settings_default_has_presets() {
        let settings = AgentSettings::default();
        assert!(settings.presets.contains_key("shell"));
        assert!(settings.presets.contains_key("claude"));
        assert!(settings.presets.contains_key("cursor"));
        assert!(settings.presets.contains_key("aider"));
    }

    // ==================== Edge Cases ====================

    #[test]
    fn test_settings_state_multiple_updates() {
        let state = SettingsState::new();

        // Multiple sequential updates
        for _ in 0..3 {
            let settings = state.get_agent_settings().expect("Should get settings");
            state
                .update_agent_settings(settings)
                .expect("Should update settings");
        }

        // Should still work after multiple updates
        let final_settings = state.get_agent_settings();
        assert!(final_settings.is_ok());
    }

    #[test]
    fn test_check_command_special_chars() {
        // Command with special characters
        let result = check_command_exists("command-with-dash".to_string());
        assert!(result.is_ok());
        // Just verify it doesn't crash
    }

    #[test]
    fn test_check_command_unicode() {
        // Command with unicode (unlikely to exist but shouldn't crash)
        let result = check_command_exists("命令".to_string());
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }
}
