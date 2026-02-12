//! Hook installation and management for agent notification integration.
//!
//! This module handles:
//! - Generating hook scripts for different agents (Claude, Codex, Gemini)
//! - Installing/uninstalling hooks in agent config directories
//! - Updating agent configuration files to enable hooks
//! - Checking hook installation status

use codelane_core::config::AgentType;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Hook installation status for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookStatus {
    pub agent_type: String,
    pub installed: bool,
    pub supported: bool,
}

/// Generate Claude Code hook script
fn generate_claude_script(hook_events_dir: &str) -> String {
    format!(
        r#"#!/bin/bash
# Codelane hook for Claude Code
# Auto-generated - do not edit manually

LANE_ID="${{CODELANE_LANE_ID}}"
HOOK_DIR="{}"

if [ -z "$LANE_ID" ]; then
    exit 0
fi

EVENT_DIR="$HOOK_DIR/$LANE_ID"
mkdir -p "$EVENT_DIR"

TIMESTAMP=$(date +%s%N)
EVENT_FILE="$EVENT_DIR/event-$TIMESTAMP.json"

# Get event type from argument (default: permission_prompt)
EVENT_TYPE="${{1:-permission_prompt}}"
MESSAGE="${{2:-}}"

# Write JSON event
cat > "$EVENT_FILE" <<'EOF'
{{
  "laneId": "$LANE_ID",
  "agentType": "claude",
  "eventType": "$EVENT_TYPE",
  "timestamp": $(date +%s)
}}
EOF
"#,
        hook_events_dir
    )
}

/// Generate Codex hook script
fn generate_codex_script(hook_events_dir: &str) -> String {
    format!(
        r#"#!/bin/bash
# Codelane hook for Codex
# Auto-generated - do not edit manually

LANE_ID="${{CODELANE_LANE_ID}}"
HOOK_DIR="{}"

if [ -z "$LANE_ID" ]; then
    exit 0
fi

EVENT_DIR="$HOOK_DIR/$LANE_ID"
mkdir -p "$EVENT_DIR"

TIMESTAMP=$(date +%s%N)
EVENT_FILE="$EVENT_DIR/event-$TIMESTAMP.json"

# Write JSON event
cat > "$EVENT_FILE" <<'EOF'
{{
  "laneId": "$LANE_ID",
  "agentType": "codex",
  "eventType": "waiting_for_input",
  "timestamp": $(date +%s)
}}
EOF
"#,
        hook_events_dir
    )
}

/// Generate Gemini CLI hook script
fn generate_gemini_script(hook_events_dir: &str) -> String {
    format!(
        r#"#!/bin/bash
# Codelane hook for Gemini CLI
# Auto-generated - do not edit manually

LANE_ID="${{CODELANE_LANE_ID}}"
HOOK_DIR="{}"

if [ -z "$LANE_ID" ]; then
    exit 0
fi

EVENT_DIR="$HOOK_DIR/$LANE_ID"
mkdir -p "$EVENT_DIR"

TIMESTAMP=$(date +%s%N)
EVENT_FILE="$EVENT_DIR/event-$TIMESTAMP.json"

# Write JSON event
cat > "$EVENT_FILE" <<'EOF'
{{
  "laneId": "$LANE_ID",
  "agentType": "gemini",
  "eventType": "waiting_for_input",
  "timestamp": $(date +%s)
}}
EOF
"#,
        hook_events_dir
    )
}

/// Get the configuration directory for an agent
fn get_agent_config_dir(agent_type: AgentType) -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;

    let config_dir = match agent_type {
        AgentType::Claude => PathBuf::from(home).join(".claude"),
        AgentType::Codex => PathBuf::from(home).join(".codex"),
        AgentType::Gemini => PathBuf::from(home).join(".gemini"),
        _ => return Err(format!("Agent type {:?} does not support hooks", agent_type)),
    };

    Ok(config_dir)
}

/// Install hook script with executable permissions
fn install_hook_script(script_content: &str, target_path: &Path) -> Result<(), String> {
    fs::write(target_path, script_content)
        .map_err(|e| format!("Failed to write hook script: {}", e))?;

    // Make executable on Unix systems
    #[cfg(unix)]
    {
        let metadata = fs::metadata(target_path)
            .map_err(|e| format!("Failed to get file metadata: {}", e))?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(target_path, permissions)
            .map_err(|e| format!("Failed to set executable permissions: {}", e))?;
    }

    Ok(())
}

/// Update Claude Code settings.json to enable hooks
fn update_claude_config(hook_script_path: &Path) -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let settings_path = PathBuf::from(home).join(".claude/settings.json");

    // Read existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("Failed to read Claude settings: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Add hooks configuration
    let hook_path_str = hook_script_path.to_string_lossy();
    settings["hooks"] = serde_json::json!({
        "Notification": [
            {
                "matcher": "permission_prompt",
                "hooks": [{
                    "type": "command",
                    "command": format!("{} permission_prompt", hook_path_str)
                }]
            },
            {
                "matcher": "idle_prompt",
                "hooks": [{
                    "type": "command",
                    "command": format!("{} idle_prompt", hook_path_str)
                }]
            }
        ]
    });

    // Write back
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write Claude settings: {}", e))?;

    Ok(())
}

/// Update Codex config.json to enable notify hooks
fn update_codex_config(hook_script_path: &Path) -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let config_path = PathBuf::from(home).join(".codex/config.json");

    let mut config: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read Codex config: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Add notify configuration
    config["notify"] = serde_json::json!({
        "approval_requested": hook_script_path.to_string_lossy()
    });

    // Write back
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write Codex config: {}", e))?;

    Ok(())
}

/// Update Gemini hooks.yaml to enable hooks
fn update_gemini_config(hook_script_path: &Path) -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let hooks_path = PathBuf::from(home).join(".gemini/hooks.yaml");

    // Create hooks.yaml with Codelane hook
    let yaml_content = format!(
        r#"hooks:
  Notification:
    - matcher: ".*"
      command: {}
"#,
        hook_script_path.to_string_lossy()
    );

    fs::write(&hooks_path, yaml_content)
        .map_err(|e| format!("Failed to write Gemini hooks.yaml: {}", e))?;

    Ok(())
}

/// Remove hooks from Claude Code settings
fn remove_claude_hooks() -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let settings_path = PathBuf::from(home).join(".claude/settings.json");

    if !settings_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read Claude settings: {}", e))?;
    let mut settings: serde_json::Value = serde_json::from_str(&content)
        .unwrap_or_else(|_| serde_json::json!({}));

    // Remove hooks section
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("hooks");
    }

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write Claude settings: {}", e))?;

    Ok(())
}

/// Remove hooks from Codex config
fn remove_codex_hooks() -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let config_path = PathBuf::from(home).join(".codex/config.json");

    if !config_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read Codex config: {}", e))?;
    let mut config: serde_json::Value = serde_json::from_str(&content)
        .unwrap_or_else(|_| serde_json::json!({}));

    if let Some(obj) = config.as_object_mut() {
        obj.remove("notify");
    }

    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write Codex config: {}", e))?;

    Ok(())
}

/// Remove Gemini hooks.yaml
fn remove_gemini_hooks() -> Result<(), String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;
    let hooks_path = PathBuf::from(home).join(".gemini/hooks.yaml");

    if hooks_path.exists() {
        fs::remove_file(&hooks_path)
            .map_err(|e| format!("Failed to remove Gemini hooks.yaml: {}", e))?;
    }

    Ok(())
}

/// Parse agent type string to AgentType enum
fn parse_agent_type(agent_type: &str) -> Result<AgentType, String> {
    match agent_type {
        "claude" => Ok(AgentType::Claude),
        "codex" => Ok(AgentType::Codex),
        "gemini" => Ok(AgentType::Gemini),
        "aider" => Ok(AgentType::Aider),
        "cursor" => Ok(AgentType::Cursor),
        "opencode" => Ok(AgentType::OpenCode),
        "shell" => Ok(AgentType::Shell),
        _ => Err(format!("Unknown agent type: {}", agent_type)),
    }
}

/// Check if hooks are installed for an agent
fn check_hook_installation(agent_type: AgentType) -> Result<bool, String> {
    let config_dir = get_agent_config_dir(agent_type)?;
    let hook_file = config_dir.join("hooks").join("codelane.sh");
    Ok(hook_file.exists())
}

/// Install hooks for an agent
#[tauri::command]
pub async fn hooks_install(agent_type: String) -> Result<(), String> {
    let agent = parse_agent_type(&agent_type)?;

    // Get hook events directory
    let hook_events_dir = codelane_core::paths::hook_events_dir()
        .map_err(|e| format!("Failed to get hook events dir: {}", e))?;

    // Generate script based on agent type
    let script = match agent {
        AgentType::Claude => generate_claude_script(&hook_events_dir.to_string_lossy()),
        AgentType::Codex => generate_codex_script(&hook_events_dir.to_string_lossy()),
        AgentType::Gemini => generate_gemini_script(&hook_events_dir.to_string_lossy()),
        _ => return Err(format!("Agent {:?} does not support hooks", agent)),
    };

    // Get agent config directory and create hooks subdirectory
    let config_dir = get_agent_config_dir(agent.clone())?;
    let hooks_dir = config_dir.join("hooks");
    fs::create_dir_all(&hooks_dir)
        .map_err(|e| format!("Failed to create hooks directory: {}", e))?;

    // Install hook script
    let target_path = hooks_dir.join("codelane.sh");
    install_hook_script(&script, &target_path)?;

    // Update agent configuration to use the hook
    match agent {
        AgentType::Claude => update_claude_config(&target_path)?,
        AgentType::Codex => update_codex_config(&target_path)?,
        AgentType::Gemini => update_gemini_config(&target_path)?,
        _ => {}
    }

    Ok(())
}

/// Uninstall hooks for an agent
#[tauri::command]
pub async fn hooks_uninstall(agent_type: String) -> Result<(), String> {
    let agent = parse_agent_type(&agent_type)?;

    // Remove hook script
    let config_dir = get_agent_config_dir(agent.clone())?;
    let hook_file = config_dir.join("hooks").join("codelane.sh");

    if hook_file.exists() {
        fs::remove_file(&hook_file)
            .map_err(|e| format!("Failed to remove hook script: {}", e))?;
    }

    // Remove from agent configuration
    match agent {
        AgentType::Claude => remove_claude_hooks()?,
        AgentType::Codex => remove_codex_hooks()?,
        AgentType::Gemini => remove_gemini_hooks()?,
        _ => {}
    }

    Ok(())
}

/// Check hook installation status for an agent
#[tauri::command]
pub async fn hooks_check_status(agent_type: String) -> Result<HookStatus, String> {
    let agent = parse_agent_type(&agent_type)?;

    let supported = matches!(agent, AgentType::Claude | AgentType::Codex | AgentType::Gemini);
    let installed = if supported {
        check_hook_installation(agent.clone()).unwrap_or(false)
    } else {
        false
    };

    Ok(HookStatus {
        agent_type,
        installed,
        supported,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_claude_script() {
        let script = generate_claude_script("/tmp/hooks");
        assert!(script.contains("#!/bin/bash"));
        assert!(script.contains("CODELANE_LANE_ID"));
        assert!(script.contains("/tmp/hooks"));
        assert!(script.contains("claude"));
    }

    #[test]
    fn test_generate_codex_script() {
        let script = generate_codex_script("/tmp/hooks");
        assert!(script.contains("#!/bin/bash"));
        assert!(script.contains("CODELANE_LANE_ID"));
        assert!(script.contains("codex"));
    }

    #[test]
    fn test_generate_gemini_script() {
        let script = generate_gemini_script("/tmp/hooks");
        assert!(script.contains("#!/bin/bash"));
        assert!(script.contains("CODELANE_LANE_ID"));
        assert!(script.contains("gemini"));
    }

    #[test]
    fn test_get_agent_config_dir_claude() {
        let result = get_agent_config_dir(AgentType::Claude);
        assert!(result.is_ok());
        assert!(result.unwrap().to_string_lossy().ends_with(".claude"));
    }

    #[test]
    fn test_get_agent_config_dir_unsupported() {
        let result = get_agent_config_dir(AgentType::Shell);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not support hooks"));
    }
}
