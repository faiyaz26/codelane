//! GitHub CLI (gh) Tauri commands for Codelane
//!
//! Wraps the `gh` CLI for PR review operations.
//! Requires `gh` to be installed and authenticated.

use std::process::Command;

use serde::Serialize;

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

// ============================================================================
// Helper Functions
// ============================================================================

/// Run a gh command and return stdout
fn run_gh(args: &[&str]) -> Result<String, String> {
    let output = Command::new("gh")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Check gh CLI installation and authentication status
#[tauri::command]
pub async fn github_check_status() -> Result<GhCliStatus, String> {
    // 1. Check if gh is installed
    let installed = match check_command_exists("gh".to_string()) {
        Ok(Some(_)) => true,
        _ => false,
    };

    if !installed {
        return Ok(GhCliStatus {
            installed: false,
            authenticated: false,
            user: None,
            version: None,
        });
    }

    // 2. Get version
    let version = run_gh(&["--version"])
        .ok()
        .and_then(|v| v.lines().next().map(|l| l.to_string()));

    // 3. Check authentication
    let auth_output = Command::new("gh")
        .args(["auth", "status"])
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
        installed,
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

    Ok(PullRequestInfo {
        number: json["number"].as_u64().unwrap_or(0) as u32,
        title: json["title"].as_str().unwrap_or("").to_string(),
        author: json["author"]["login"].as_str().unwrap_or("").to_string(),
        base_branch: json["baseRefName"].as_str().unwrap_or("").to_string(),
        head_branch: json["headRefName"].as_str().unwrap_or("").to_string(),
        head_sha: json["headRefOid"].as_str().unwrap_or("").to_string(),
        repo_url: json["url"].as_str().unwrap_or("").to_string(),
        repo_name: extract_repo_name(json["url"].as_str().unwrap_or("")),
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
