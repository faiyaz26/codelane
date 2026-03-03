//! GitHub CLI (gh) Tauri commands for Codelane
//!
//! Wraps the `gh` CLI for PR review operations.
//! Requires `gh` to be installed and authenticated.

use std::io::Write;
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::settings::check_command_exists;

// ============================================================================
// Result Types
// ============================================================================

/// Status of the gh CLI installation and authentication
#[derive(Debug, Clone, Serialize)]
pub struct GhCliStatus {
    /// Whether the gh binary is found on PATH
    pub installed: bool,
    /// Whether the user is authenticated via gh auth
    pub authenticated: bool,
    /// GitHub username if authenticated
    pub user: Option<String>,
    /// gh CLI version string
    pub version: Option<String>,
}

/// Information about a pull request
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestInfo {
    pub number: u32,
    pub title: String,
    pub author: String,
    pub base_branch: String,
    pub head_branch: String,
    pub head_sha: String,
    pub repo_url: String,
    pub repo_name: String,
    pub body: String,
    pub state: String,
    pub files_changed: u32,
    pub additions: u32,
    pub deletions: u32,
}

/// An inline review comment on a PR diff
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrReviewComment {
    pub id: u64,
    pub path: String,
    pub line: Option<u32>,
    pub original_line: Option<u32>,
    pub side: Option<String>,
    pub body: String,
    pub user: String,
    pub created_at: String,
    pub updated_at: String,
    pub in_reply_to_id: Option<u64>,
}

/// A top-level PR conversation comment (issue comment)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrConversationComment {
    pub id: u64,
    pub body: String,
    pub user: String,
    pub created_at: String,
    pub updated_at: String,
    pub author_association: String,
}

/// A single inline comment to submit as part of a review
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ReviewInlineComment {
    pub path: String,
    pub line: u32,
    pub side: String,
    pub body: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Run a gh command and return stdout
fn run_gh(args: &[&str]) -> Result<String, String> {
    // Resolve absolute path for production robustness
    let gh_path = match check_command_exists("gh".to_string()) {
        Ok(Some(path)) => path,
        _ => "gh".to_string(), // Fallback to bare command
    };

    let string_args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    let mut command = if cfg!(unix) {
        let (shell, shell_args) = build_unix_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    } else {
        let (shell, shell_args) = build_windows_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    };

    let output = command
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Build Unix command args using a login interactive shell
fn build_unix_cmd(cmd_path: &str, args: Vec<String>) -> (String, Vec<String>) {
    let login_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let mut full_cmd = format!("'{}'", cmd_path);
    for arg in args {
        full_cmd.push_str(&format!(" '{}'", arg.replace('\'', "'\\''")));
    }
    (login_shell, vec!["-li".to_string(), "-c".to_string(), full_cmd])
}

/// Build Windows command args using cmd /C
fn build_windows_cmd(cmd_path: &str, args: Vec<String>) -> (String, Vec<String>) {
    let mut full_cmd = format!("\"{}\"", cmd_path);
    for arg in args {
        // Simple escaping for Windows cmd: escape double quotes by doubling them
        full_cmd.push_str(&format!(" \"{}\"", arg.replace('"', "\"\"")));
    }
    // For cmd /C, if the command string is quoted, it's often safer to wrap the entire 
    // string in ANOTHER set of quotes because cmd.exe stripping logic is peculiar.
    ("cmd".to_string(), vec!["/C".to_string(), format!("\"{}\"", full_cmd)])
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Check gh CLI installation and authentication status
#[tauri::command]
pub async fn github_check_status() -> Result<GhCliStatus, String> {
    // 1. Check if gh is installed and get its path
    let gh_path = match check_command_exists("gh".to_string()) {
        Ok(Some(path)) => path,
        _ => {
            return Ok(GhCliStatus {
                installed: false,
                authenticated: false,
                user: None,
                version: None,
            });
        }
    };

    // 2. Get version
    let version = run_gh(&["--version"])
        .ok()
        .and_then(|v| v.lines().next().map(|l| l.to_string()));

    // 3. Check authentication
    let string_args = vec!["auth".to_string(), "status".to_string()];
    let mut auth_cmd = if cfg!(unix) {
        let (shell, shell_args) = build_unix_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    } else {
        let (shell, shell_args) = build_windows_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    };

    let auth_output = auth_cmd
        .output()
        .map_err(|e| format!("Failed to run gh auth status: {}", e))?;

    let authenticated = auth_output.status.success();

    // Parse username from auth status output (appears in both stdout and stderr)
    let auth_text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&auth_output.stdout),
        String::from_utf8_lossy(&auth_output.stderr)
    );

    let user = auth_text
        .lines()
        .find(|line| line.contains("Logged in to") || line.contains("account"))
        .and_then(|line| {
            // Try to extract username - gh outputs "Logged in to github.com account <user>"
            line.split_whitespace()
                .last()
                .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_').to_string())
        })
        .filter(|s| !s.is_empty());

    Ok(GhCliStatus {
        installed: true,
        authenticated,
        user,
        version,
    })
}

/// Fetch pull request information from a GitHub PR URL or reference
#[tauri::command]
pub async fn github_fetch_pr(pr_url: String) -> Result<PullRequestInfo, String> {
    let output = run_gh(&[
        "pr", "view", &pr_url,
        "--json", "number,title,author,baseRefName,headRefName,headRefOid,url,body,state,changedFiles,additions,deletions",
    ])?;

    // Parse JSON output
    let json: serde_json::Value = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse gh output: {}", e))?;

    let pr_web_url = json["url"].as_str().unwrap_or("");
    let repo_name = extract_repo_name(pr_web_url);
    
    // Construct a standard HTTPS clone URL from the repo name
    // This is a reliable fallback when the direct repository.url field isn't in the partial JSON view
    let repo_url = if !repo_name.is_empty() {
        format!("https://github.com/{}.git", repo_name)
    } else {
        String::new()
    };

    Ok(PullRequestInfo {
        number: json["number"].as_u64().unwrap_or(0) as u32,
        title: json["title"].as_str().unwrap_or("").to_string(),
        author: json["author"]["login"].as_str().unwrap_or("").to_string(),
        base_branch: json["baseRefName"].as_str().unwrap_or("").to_string(),
        head_branch: json["headRefName"].as_str().unwrap_or("").to_string(),
        head_sha: json["headRefOid"].as_str().unwrap_or("").to_string(),
        repo_url,
        repo_name,
        body: json["body"].as_str().unwrap_or("").to_string(),
        state: json["state"].as_str().unwrap_or("").to_string(),
        files_changed: json["changedFiles"].as_u64().unwrap_or(0) as u32,
        additions: json["additions"].as_u64().unwrap_or(0) as u32,
        deletions: json["deletions"].as_u64().unwrap_or(0) as u32,
    })
}

/// Submit a review on a pull request
#[tauri::command]
pub async fn github_submit_review(
    pr_url: String,
    review_type: String,
    body: Option<String>,
) -> Result<String, String> {
    let type_flag = match review_type.as_str() {
        "approve" => "--approve",
        "comment" => "--comment",
        "request_changes" => "--request-changes",
        _ => return Err(format!("Invalid review type: {}", review_type)),
    };

    let mut args = vec!["pr", "review", &pr_url, type_flag];

    let body_str;
    if let Some(ref b) = body {
        if !b.trim().is_empty() {
            body_str = b.clone();
            args.push("--body");
            args.push(&body_str);
        }
    }

    run_gh(&args)?;

    Ok(format!("Review submitted: {}", review_type))
}

/// Fetch inline review comments on a PR
#[tauri::command]
pub async fn github_fetch_pr_review_comments(
    repo_name: String,
    pr_number: u32,
) -> Result<Vec<PrReviewComment>, String> {
    let endpoint = format!("repos/{}/pulls/{}/comments", repo_name, pr_number);
    let output = run_gh(&["api", &endpoint, "--paginate"])?;

    // gh api --paginate may return empty for no comments
    if output.is_empty() {
        return Ok(vec![]);
    }

    let json: Vec<serde_json::Value> = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse review comments: {}", e))?;

    let comments = json
        .into_iter()
        .map(|c| PrReviewComment {
            id: c["id"].as_u64().unwrap_or(0),
            path: c["path"].as_str().unwrap_or("").to_string(),
            line: c["line"].as_u64().map(|n| n as u32),
            original_line: c["original_line"].as_u64().map(|n| n as u32),
            side: c["side"].as_str().map(|s| s.to_string()),
            body: c["body"].as_str().unwrap_or("").to_string(),
            user: c["user"]["login"].as_str().unwrap_or("").to_string(),
            created_at: c["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: c["updated_at"].as_str().unwrap_or("").to_string(),
            in_reply_to_id: c["in_reply_to_id"].as_u64(),
        })
        .collect();

    Ok(comments)
}

/// Fetch top-level PR conversation comments (issue comments)
#[tauri::command]
pub async fn github_fetch_pr_conversation(
    repo_name: String,
    pr_number: u32,
) -> Result<Vec<PrConversationComment>, String> {
    let endpoint = format!("repos/{}/issues/{}/comments", repo_name, pr_number);
    let output = run_gh(&["api", &endpoint, "--paginate"])?;

    if output.is_empty() {
        return Ok(vec![]);
    }

    let json: Vec<serde_json::Value> = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse conversation comments: {}", e))?;

    let comments = json
        .into_iter()
        .map(|c| PrConversationComment {
            id: c["id"].as_u64().unwrap_or(0),
            body: c["body"].as_str().unwrap_or("").to_string(),
            user: c["user"]["login"].as_str().unwrap_or("").to_string(),
            created_at: c["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: c["updated_at"].as_str().unwrap_or("").to_string(),
            author_association: c["author_association"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(comments)
}

/// Submit a review with inline comments on a PR
#[tauri::command]
pub async fn github_submit_review_with_comments(
    repo_name: String,
    pr_number: u32,
    commit_id: String,
    event: String,
    body: Option<String>,
    comments: Vec<ReviewInlineComment>,
) -> Result<String, String> {
    // Resolve absolute path for production robustness
    let gh_path = match check_command_exists("gh".to_string()) {
        Ok(Some(path)) => path,
        _ => "gh".to_string(),
    };

    let payload = serde_json::json!({
        "commit_id": commit_id,
        "event": event,
        "body": body.unwrap_or_default(),
        "comments": comments,
    });

    let endpoint = format!("repos/{}/pulls/{}/reviews", repo_name, pr_number);
    let payload_str = payload.to_string();
    let string_args = vec![
        "api".to_string(), 
        endpoint, 
        "--method".to_string(), 
        "POST".to_string(), 
        "--input".to_string(), 
        "-".to_string()
    ];

    // Pipe JSON payload via stdin
    let mut child_cmd = if cfg!(unix) {
        let (shell, shell_args) = build_unix_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    } else {
        let (shell, shell_args) = build_windows_cmd(&gh_path, string_args);
        let mut cmd = Command::new(shell);
        cmd.args(shell_args);
        cmd
    };

    let mut child = child_cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(payload_str.as_bytes())
            .map_err(|e| format!("Failed to write to gh stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to wait for gh: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(format!(
        "Review submitted with {} inline comments",
        comments.len()
    ))
}

// ============================================================================
// Helpers
// ============================================================================

/// Extract "owner/repo" from a GitHub URL
fn extract_repo_name(url: &str) -> String {
    // Handle URLs like https://github.com/owner/repo/pull/123
    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() >= 5 {
        format!("{}/{}", parts[3], parts[4])
    } else {
        String::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name() {
        assert_eq!(extract_repo_name("https://github.com/owner/repo/pull/123"), "owner/repo");
        assert_eq!(extract_repo_name("https://github.com/faiyaz26/codelane"), "faiyaz26/codelane");
        assert_eq!(extract_repo_name("invalid-url"), "");
    }

    #[test]
    fn test_build_windows_gh_cmd() {
        let args = vec!["pr".to_string(), "view".to_string()];
        let (shell, shell_args) = build_windows_cmd("C:\\bin\\gh.exe", args);
        
        assert_eq!(shell, "cmd");
        assert_eq!(shell_args[0], "/C");
        // The entire command string should be wrapped in quotes
        assert!(shell_args[1].starts_with('"'));
        assert!(shell_args[1].ends_with('"'));
        assert!(shell_args[1].contains("\"C:\\bin\\gh.exe\""));
        assert!(shell_args[1].contains("\"pr\""));
        assert!(shell_args[1].contains("\"view\""));
    }
}
