//! AI code changes summary integration via CLI tools
//!
//! Provides commands to invoke local AI CLI tools (claude-code, aider, opencode, gemini)
//! for code changes summaries and feedback.

use serde::Serialize;
use std::process::{Command, Stdio};
use std::io::Write;

#[derive(Debug, Clone, Serialize)]
pub struct AIReviewResult {
    pub success: bool,
    pub content: String,
    pub error: Option<String>,
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
        _ => return Err(format!("Unsupported AI tool: {}", tool)),
    };

    match result {
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

/// Execute Claude Code CLI
fn execute_claude(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    eprintln!("[AI] Executing Claude with model: {:?}, prompt length: {}", model, prompt.len());

    if !command_exists("claude") {
        return Err("Claude Code CLI not found. Install: npm install -g @anthropic-ai/claude-code".to_string());
    }

    // Write prompt to temp file
    let temp_dir = std::env::temp_dir();
    let prompt_file = temp_dir.join(format!("codelane_prompt_{}.txt", std::process::id()));
    std::fs::write(&prompt_file, prompt)
        .map_err(|e| format!("Failed to write prompt file: {}", e))?;

    let mut command = Command::new("claude");
    command
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add model selection if provided
    if let Some(model_name) = model {
        command.arg("--model").arg(model_name);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    // Write prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        drop(stdin);
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for output: {}", e))?;

    // Clean up temp file
    let _ = std::fs::remove_file(prompt_file);

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        eprintln!("[AI] Claude completed successfully, output length: {}", stdout.len());
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[AI] Claude failed with exit code: {:?}", output.status.code());
        eprintln!("[AI] Claude stderr: {}", stderr);
        Err(format!("Claude error: {}", stderr))
    }
}

/// Execute Aider CLI
fn execute_aider(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    eprintln!("[AI] Executing Aider with model: {:?}, prompt length: {}", model, prompt.len());

    if !command_exists("aider") {
        return Err("Aider not found. Install: pip install aider-chat".to_string());
    }

    let mut command = Command::new("aider");
    command
        .arg("--yes")
        .arg("--no-auto-commits")
        .arg("--message")
        .arg(prompt)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add model selection if provided
    if let Some(model_name) = model {
        command.arg("--model").arg(model_name);
    }

    let output = command
        .output()
        .map_err(|e| format!("Failed to execute aider: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        eprintln!("[AI] Aider completed successfully, output length: {}", stdout.len());
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[AI] Aider failed with exit code: {:?}", output.status.code());
        eprintln!("[AI] Aider stderr: {}", stderr);
        Err(format!("Aider error: {}", stderr))
    }
}

/// Execute OpenCode CLI
fn execute_opencode(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    eprintln!("[AI] Executing OpenCode with model: {:?}, prompt length: {}", model, prompt.len());

    if !command_exists("opencode") {
        return Err("OpenCode not found. Install: npm install -g opencode".to_string());
    }

    let mut command = Command::new("opencode");
    command
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add model selection if provided (opencode uses --model flag)
    if let Some(model_name) = model {
        command.arg("--model").arg(model_name);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn opencode: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        drop(stdin);
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for output: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        eprintln!("[AI] OpenCode completed successfully, output length: {}", stdout.len());
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[AI] OpenCode failed with exit code: {:?}", output.status.code());
        eprintln!("[AI] OpenCode stderr: {}", stderr);
        Err(format!("OpenCode error: {}", stderr))
    }
}

/// Execute Gemini CLI
fn execute_gemini(prompt: &str, working_dir: &str, model: Option<&str>) -> Result<String, String> {
    eprintln!("[AI] Executing Gemini with model: {:?}, prompt length: {}", model, prompt.len());

    if !command_exists("gemini") {
        return Err("Gemini CLI not found. Install: npm install -g @google/generative-ai-cli".to_string());
    }

    let mut command = Command::new("gemini");
    command
        .arg("chat")
        .current_dir(working_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Add model selection if provided
    if let Some(model_name) = model {
        command.arg("--model").arg(model_name);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn gemini: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        drop(stdin);
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for output: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        eprintln!("[AI] Gemini completed successfully, output length: {}", stdout.len());
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[AI] Gemini failed with exit code: {:?}", output.status.code());
        eprintln!("[AI] Gemini stderr: {}", stderr);
        Err(format!("Gemini error: {}", stderr))
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
