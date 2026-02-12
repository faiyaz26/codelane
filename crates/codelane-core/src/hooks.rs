//! Hook event types for agent notification integration.
//!
//! Codelane integrates with agents' (Claude Code, Codex, Gemini) built-in hook systems
//! to receive reliable notifications when they need user input.

use serde::{Deserialize, Serialize};

/// Type of hook event received from an agent
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum HookEventType {
    /// Agent needs permission to use a tool
    PermissionPrompt,
    /// Agent has been idle and waiting for input
    IdlePrompt,
    /// Generic waiting for user input
    WaitingForInput,
}

/// Hook event payload sent from agent hook scripts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEvent {
    /// Lane ID where the agent is running
    pub lane_id: String,
    /// Type of agent that triggered the hook
    pub agent_type: String,
    /// Type of event
    pub event_type: HookEventType,
    /// Unix timestamp when event occurred
    pub timestamp: i64,
    /// Optional message from the agent
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl HookEvent {
    /// Create a new hook event
    pub fn new(lane_id: String, agent_type: String, event_type: HookEventType) -> Self {
        Self {
            lane_id,
            agent_type,
            event_type,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            message: None,
        }
    }

    /// Create with message
    pub fn with_message(mut self, message: String) -> Self {
        self.message = Some(message);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_event_creation() {
        let event = HookEvent::new(
            "lane-123".to_string(),
            "claude".to_string(),
            HookEventType::PermissionPrompt,
        );

        assert_eq!(event.lane_id, "lane-123");
        assert_eq!(event.agent_type, "claude");
        assert_eq!(event.event_type, HookEventType::PermissionPrompt);
        assert!(event.timestamp > 0);
        assert!(event.message.is_none());
    }

    #[test]
    fn test_hook_event_with_message() {
        let event = HookEvent::new(
            "lane-123".to_string(),
            "claude".to_string(),
            HookEventType::IdlePrompt,
        )
        .with_message("Test message".to_string());

        assert_eq!(event.message, Some("Test message".to_string()));
    }

    #[test]
    fn test_hook_event_serialization() {
        let event = HookEvent::new(
            "lane-123".to_string(),
            "claude".to_string(),
            HookEventType::WaitingForInput,
        );

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("lane-123"));
        assert!(json.contains("claude"));
        assert!(json.contains("waiting_for_input"));
    }

    #[test]
    fn test_hook_event_deserialization() {
        let json = r#"{
            "laneId": "lane-123",
            "agentType": "codex",
            "eventType": "permission_prompt",
            "timestamp": 1234567890
        }"#;

        let event: HookEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.lane_id, "lane-123");
        assert_eq!(event.agent_type, "codex");
        assert_eq!(event.event_type, HookEventType::PermissionPrompt);
        assert_eq!(event.timestamp, 1234567890);
    }
}
