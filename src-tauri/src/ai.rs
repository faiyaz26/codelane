//! AI code review integration via CLI tools
//!
//! Provides commands to invoke local AI CLI tools (claude-code, aider, opencode, gemini)
//! for code review, summaries, and feedback.

use serde::Serialize;
use std::process::{Command, Stdio};
use std::io::Write;

#[derive(Debug, Clone, Serialize)]
pub struct AIReviewResult {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
}

/// Generate a code review summary using the configured AI tool
#[tauri::command]
pub async fn ai_generate_review(
    tool: String,
    diff_content: String,
    prompt: String,
    working_dir: String,
) -> Result<AIReviewResult, String> {
    // Determine which CLI command to use
    let (cmd_name, args) = match tool.as_str() {
        "claude" => ("claude", vec!["--no-input"]),
        "aider" => ("aider", vec!["--no-auto-commits", "--yes"]),
        "opencode" => ("opencode", vec![]),
        "gemini" => ("gemini", vec!["chat"]),
        _ => return Err(format!("Unsupported AI tool: {}", tool)),
    };

    // Check if command exists
    if !command_exists(cmd_name) {
        return Ok(AIReviewResult {
            success: false,
            content: String::new(),
            error: Some(format!(
                "Command '{}' not found. Please install {} first.",
                cmd_name, tool
            )),
        });
    }

    // Build the full prompt
    let full_prompt = format!(
        "{}\n\n# Code Changes\n\n```diff\n{}\n```\n\nPlease provide a concise code review.",
        prompt, diff_content
    );

    // Execute the command
    match execute_ai_command(cmd_name, &args, &full_prompt, &working_dir) {
        Ok(output) => Ok(AIReviewResult {
            success: true,
            content: output,
            error: None,
        }),
        Err(e) => Ok(AIReviewResult {
            success: false,
            content: String::new(),
            error: Some(e),
        }),
    }
}

/// Check if a command exists in PATH
fn command_exists(cmd: &str) -> bool {
    Command::new("which")
        .arg(cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// Execute an AI CLI command with the given prompt
fn execute_ai_command(
    cmd: &str,
    args: &[&str],
    prompt: &str,
    working_dir: &str,
) -> Result<String, String> {
    let mut command = Command::new(cmd);
    command
        .args(args)
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        // Drop stdin to close the pipe
        drop(stdin);
    }

    // Wait for output
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for output: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Test if an AI tool is available
#[tauri::command]
pub async fn ai_test_tool(tool: String) -> Result<bool, String> {
    let cmd_name = match tool.as_str() {
        "claude" => "claude",
        "aider" => "aider",
        "opencode" => "opencode",
        "gemini" => "gemini",
        _ => return Err(format!("Unknown tool: {}", tool)),
    };

    Ok(command_exists(cmd_name))
}

/// Get available AI tools (those that are installed)
#[tauri::command]
pub async fn ai_get_available_tools() -> Result<Vec<String>, String> {
    let tools = vec!["claude", "aider", "opencode", "gemini"];
    let available: Vec<String> = tools
        .into_iter()
        .filter(|tool| command_exists(tool))
        .map(|s| s.to_string())
        .collect();

    Ok(available)
}
