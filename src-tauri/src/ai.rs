//! AI code changes summary integration via CLI tools
//!
//! Provides commands to invoke local AI CLI tools (claude-code, aider, opencode, gemini)
//! for code changes summaries and feedback.

use serde::Serialize;
use std::process::{Command, Stdio};
use std::io::Write;
use crate::settings::command_exists;

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

/// Build Unix command args using a login interactive shell
fn build_unix_cmd(cmd_path: &str, args: Vec<String>) -> (String, Vec<String>) {
    let login_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut full_cmd = format!("'{}'", cmd_path);
    for arg in args {
        // Escape single quotes for shell safety
        full_cmd.push_str(&format!(" '{}'", arg.replace('\'', "'\\''")));
    }
    (login_shell, vec!["-li".to_string(), "-c".to_string(), full_cmd])
}

/// Build Windows command args using cmd /C
fn build_windows_cmd(cmd_path: &str, args: Vec<String>) -> (String, Vec<String>) {
    let mut full_cmd = format!("\"{}\"", cmd_path);
    for arg in args {
        // Simple quoting for Windows cmd: escape double quotes by doubling them
        full_cmd.push_str(&format!(" \"{}\"", arg.replace('"', "\"\"")));
    }
    // For cmd /C, if the command string is quoted, it's often safer to wrap the entire 
    // string in ANOTHER set of quotes because cmd.exe stripping logic is peculiar.
    ("cmd".to_string(), vec!["/C".to_string(), format!("\"{}\"", full_cmd)])
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

    Ok(command_exists(cmd_name)?.is_some())
}

/// Get available AI tools (those that are installed)
#[tauri::command]
pub async fn ai_get_available_tools() -> Result<Vec<String>, String> {
    let tools = vec!["claude", "aider", "opencode", "gemini"];
    let mut available = Vec::new();
    
    for tool in tools {
        if command_exists(tool)?.is_some() {
            available.push(tool.to_string());
        }
    }

    Ok(available)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_unix_cmd() {
        let cmd_path = "/usr/bin/claude";
        let args = vec!["--model".to_string(), "sonnet".to_string()];
        let (shell, shell_args) = build_unix_cmd(cmd_path, args);

        assert!(!shell.is_empty());
        assert_eq!(shell_args[0], "-li");
        assert_eq!(shell_args[1], "-c");
        assert!(shell_args[2].contains("'/usr/bin/claude'"));
        assert!(shell_args[2].contains("'--model'"));
        assert!(shell_args[2].contains("'sonnet'"));
    }

    #[test]
    fn test_build_unix_cmd_escaping() {
        let cmd_path = "ai";
        let args = vec!["it's a test".to_string()];
        let (_, shell_args) = build_unix_cmd(cmd_path, args);

        // it's -> 'it'\''s'
        assert!(shell_args[2].contains("'it'\\''s a test'"));
    }

    #[test]
    fn test_build_windows_cmd() {
        let cmd_path = "C:\\bin\\gemini.cmd";
        let args = vec!["--prompt".to_string(), "hello world".to_string()];
        let (shell, shell_args) = build_windows_cmd(cmd_path, args);

        assert_eq!(shell, "cmd");
        assert_eq!(shell_args[0], "/C");
        // The entire command string should be wrapped in quotes
        assert!(shell_args[1].starts_with('"'));
        assert!(shell_args[1].ends_with('"'));
        assert!(shell_args[1].contains("\"C:\\bin\\gemini.cmd\""));
        assert!(shell_args[1].contains("\"--prompt\""));
        assert!(shell_args[1].contains("\"hello world\""));
    }

    #[test]
    fn test_build_windows_cmd_escaping() {
        let cmd_path = "node";
        let args = vec!["say \"hello\"".to_string()];
        let (_, shell_args) = build_windows_cmd(cmd_path, args);

        // "hello" -> ""hello""
        // and the entire thing wrapped in quotes
        assert!(shell_args[1].contains("\"say \"\"hello\"\"\""));
        assert!(shell_args[1].starts_with('"'));
        assert!(shell_args[1].ends_with('"'));
    }
}
