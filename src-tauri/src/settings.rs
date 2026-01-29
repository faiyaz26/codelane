//! Settings management for Codelane
//!
//! Handles global application settings including agent configurations.

use codelane_core::config::{AgentConfig, AgentSettings};
use std::sync::Mutex;
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
