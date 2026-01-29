//! Lane (project workspace) management

use crate::config::AgentConfig;
use crate::{LaneId, TerminalId};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A Lane represents a project workspace with its own terminals and state
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Lane {
    /// Unique identifier
    pub id: LaneId,

    /// Display name
    pub name: String,

    /// Working directory for this lane
    pub working_dir: PathBuf,

    /// Active terminal IDs in this lane
    #[serde(default)]
    pub terminals: Vec<TerminalId>,

    /// Lane-specific configuration
    #[serde(default)]
    pub config: LaneConfig,

    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Last accessed timestamp
    pub last_accessed: chrono::DateTime<chrono::Utc>,
}

impl Lane {
    pub fn new(name: impl Into<String>, working_dir: PathBuf) -> Self {
        let now = chrono::Utc::now();
        Self {
            id: LaneId::new(),
            name: name.into(),
            working_dir,
            terminals: Vec::new(),
            config: LaneConfig::default(),
            created_at: now,
            last_accessed: now,
        }
    }

    pub fn touch(&mut self) {
        self.last_accessed = chrono::Utc::now();
    }
}

/// Lane-specific configuration
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct LaneConfig {
    /// Shell to use for terminals (None = system default)
    /// DEPRECATED: Use agent_override instead
    pub shell: Option<String>,

    /// Environment variables to set
    #[serde(default)]
    pub env: Vec<(String, String)>,

    /// Per-lane agent override (overrides global default)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_override: Option<AgentConfig>,

    /// LSP servers to enable
    #[serde(default)]
    pub lsp_servers: Vec<String>,
}

/// Manages all lanes in the application
#[derive(Debug, Default)]
pub struct LaneManager {
    lanes: Vec<Lane>,
    active_lane_id: Option<LaneId>,
}

impl LaneManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn create_lane(&mut self, name: impl Into<String>, working_dir: PathBuf) -> LaneId {
        let lane = Lane::new(name, working_dir);
        let id = lane.id;
        self.lanes.push(lane);

        // Auto-activate if this is the first lane
        if self.active_lane_id.is_none() {
            self.active_lane_id = Some(id);
        }

        id
    }

    pub fn get_lane(&self, id: LaneId) -> Option<&Lane> {
        self.lanes.iter().find(|l| l.id == id)
    }

    pub fn get_lane_mut(&mut self, id: LaneId) -> Option<&mut Lane> {
        self.lanes.iter_mut().find(|l| l.id == id)
    }

    pub fn delete_lane(&mut self, id: LaneId) -> bool {
        if let Some(pos) = self.lanes.iter().position(|l| l.id == id) {
            self.lanes.remove(pos);

            // Clear active if deleted
            if self.active_lane_id == Some(id) {
                self.active_lane_id = self.lanes.first().map(|l| l.id);
            }
            true
        } else {
            false
        }
    }

    pub fn list_lanes(&self) -> &[Lane] {
        &self.lanes
    }

    pub fn active_lane(&self) -> Option<&Lane> {
        self.active_lane_id.and_then(|id| self.get_lane(id))
    }

    pub fn active_lane_mut(&mut self) -> Option<&mut Lane> {
        if let Some(id) = self.active_lane_id {
            self.get_lane_mut(id)
        } else {
            None
        }
    }

    pub fn set_active_lane(&mut self, id: LaneId) -> bool {
        if self.lanes.iter().any(|l| l.id == id) {
            self.active_lane_id = Some(id);
            if let Some(lane) = self.get_lane_mut(id) {
                lane.touch();
            }
            true
        } else {
            false
        }
    }

    pub fn active_lane_id(&self) -> Option<LaneId> {
        self.active_lane_id
    }
}

