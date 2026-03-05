//! AI code changes summary integration via CLI tools
//!
//! Provides commands to invoke local AI CLI tools (claude-code, aider, opencode, gemini, copilot)
//! for code changes summaries and feedback.

use serde::Serialize;
use std::process::{Command, Stdio};
use std::io::Write;
use crate::settings::command_exists;
use crate::process::{build_unix_cmd, build_windows_cmd};

#[derive(Debug, Clone, Serialize)]
pub struct AIReviewResult {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
    pub error_type: Option<String>,
}

/// Generate a code changes summary with feedback using the configured AI tool
#[tauri::command]
pub async fn ai_generate_review(
    tool: String,
    diff_content: String,
    prompt: String,
    working_dir: String,
    model: Option<String>,
) -> Result<AIReviewResult, String> {
    // Build the full prompt
    let full_prompt = format!(
        "{}\n\n# Code Changes\n\n```diff\n{}\n```\n\nPlease provide a concise summary and feedback.",
        prompt, diff_content
    );

    // Execute based on tool type
    let result = match tool.as_str() {
        "claude" => execute_claude(&full_prompt, &working_dir, model.as_deref()),
        "aider" => execute_aider(&full_prompt, &working_dir, model.as_deref()),
        "opencode" => execute_opencode(&full_prompt, &working_dir, model.as_deref()),
        "gemini" => execute_gemini(&full_prompt, &working_dir, model.as_deref()),
        "copilot" => execute_copilot(&full_prompt, &working_dir, model.as_deref()),
        _ => return Err(format!("Unsupported AI tool: {}", tool)),
    };

    match result {
        Ok(output) => Ok(AIReviewResult {
            success: true,
            content: output,
            error: None,
            error_type: None,
        }),
        Err(e) => {
            let error_type = if e.contains("ModelNotFoundError") || e.contains("requested model") || e.contains("not found") && e.contains("model") {
                Some("model_not_found".to_string())
            } else if e.contains("not found") && (e.contains("command") || e.contains("installed")) {
                Some("tool_not_found".to_string())
            } else if e.contains("quota") || e.contains("rate limit") {
                Some("rate_limit".to_string())
            } else {
                Some("unknown".to_string())
            };

            Ok(AIReviewResult {
                success: false,
                content: String::new(),
                error: Some(e),
                error_type,
            })
        },
    }
}

/// Run a command, optionally wrapping it in a login shell to ensure environment is loaded
fn run_command(
    cmd_name: &str,
    args: Vec<String>,
    prompt: Option<&str>,
    working_dir: &str,
) -> Result<String, String> {
    let cmd_path = command_exists(cmd_name)?
        .ok_or_else(|| format!("{} not found. Please ensure it is installed and in your PATH.", cmd_name))?;

    let mut command = if cfg!(unix) {
        let (shell, shell_args) = build_unix_cmd(&cmd_path, args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    } else {
        let (shell, shell_args) = build_windows_cmd(&cmd_path, args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    };

    command
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", cmd_name, e))?;

    // Write prompt to stdin if provided
    if let Some(p) = prompt {
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(p.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            drop(stdin);
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for {}: {}", cmd_name, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("{} error: {}", cmd_name, stderr))
    }
}

/// Execute Claude Code CLI
fn execute_claude(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    let mut args = Vec::new();
    if let Some(model_name) = model {
        args.push("--model".to_string());
        args.push(model_name.to_string());
    }

    // Claude can take prompt from stdin
    run_command("claude", args, Some(prompt), working_dir)
}

/// Execute Aider CLI
fn execute_aider(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    let mut args = vec![
        "--yes".to_string(),
        "--no-auto-commits".to_string(),
        "--message".to_string(),
        prompt.to_string(),
    ];

    if let Some(model_name) = model {
        args.push("--model".to_string());
        args.push(model_name.to_string());
    }

    // Aider handles message via flag, doesn't strictly need stdin for this
    run_command("aider", args, None, working_dir)
}

/// Execute OpenCode CLI
fn execute_opencode(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    let mut args = Vec::new();
    if let Some(model_name) = model {
        args.push("--model".to_string());
        args.push(model_name.to_string());
    }

    // OpenCode can take prompt from stdin
    run_command("opencode", args, Some(prompt), working_dir)
}

/// Execute Gemini CLI
fn execute_gemini(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    let mut args = Vec::new();
    
    if let Some(model_name) = model {
        args.push("-m".to_string());
        args.push(model_name.to_string());
    }
    
    // Use --prompt for non-interactive mode
    args.push("--prompt".to_string());
    args.push(prompt.to_string());

    // Gemini CLI uses --prompt for non-interactive, doesn't strictly need stdin
    run_command("gemini", args, None, working_dir)
}

/// Execute GitHub Copilot CLI via standalone 'copilot' command
fn execute_copilot(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    let mut args = Vec::new();

    if let Some(model_name) = model {
        args.push("--model".to_string());
        args.push(model_name.to_string());
    }

    // Use -p for non-interactive programmatic mode
    args.push("-p".to_string());
    args.push(prompt.to_string());

    // GitHub Copilot CLI uses -p for non-interactive, doesn't strictly need stdin
    run_command("copilot", args, None, working_dir)
}

/// Test if an AI tool is available
#[tauri::command]
pub async fn ai_test_tool(tool: String) -> Result<bool, String> {
    let cmd_name = match tool.as_str() {
        "claude" => "claude",
        "aider" => "aider",
        "opencode" => "opencode",
        "gemini" => "gemini",
        "copilot" => "copilot",
        _ => return Err(format!("Unknown tool: {}", tool)),
    };

    Ok(command_exists(cmd_name)?.is_some())
}

/// Get available AI tools (those that are installed)
#[tauri::command]
pub async fn ai_get_available_tools() -> Result<Vec<String>, String> {
    let tools = vec!["claude", "aider", "opencode", "gemini", "copilot"];
    let mut available = Vec::new();
    
    for tool in tools {
        match ai_test_tool(tool.to_string()).await {
            Ok(true) => available.push(tool.to_string()),
            _ => continue,
        }
    }

    Ok(available)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_generate_review_unsupported_tool() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(ai_generate_review(
            "unsupported".to_string(),
            "diff".to_string(),
            "prompt".to_string(),
            ".".to_string(),
            None,
        ));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported AI tool"));
    }
}
