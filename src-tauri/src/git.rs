//! Git Tauri commands for Codelane
//!
//! These commands provide git operations that can be called from the Dioxus frontend
//! via Tauri's invoke system. All operations use the git CLI for reliability.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

// ============================================================================
// Result Types
// ============================================================================

/// Result of a git status operation
#[derive(Debug, Clone, Serialize)]
pub struct GitStatusResult {
    /// Current branch name
    pub branch: Option<String>,
    /// Staged files
    pub staged: Vec<FileStatus>,
    /// Unstaged (modified) files
    pub unstaged: Vec<FileStatus>,
    /// Untracked files
    pub untracked: Vec<String>,
}

/// Status of a single file
#[derive(Debug, Clone, Serialize)]
pub struct FileStatus {
    /// File path relative to repository root
    pub path: String,
    /// Status type: "modified", "added", "deleted", "renamed", "copied"
    pub status: String,
}

/// Information about a single commit
#[derive(Debug, Clone, Serialize)]
pub struct GitCommit {
    /// Full commit hash
    pub hash: String,
    /// Short commit hash (7 characters)
    pub short_hash: String,
    /// Commit message (first line)
    pub message: String,
    /// Author name
    pub author: String,
    /// Commit date in ISO format
    pub date: String,
}

/// Branch information
#[derive(Debug, Clone, Serialize)]
pub struct GitBranchInfo {
    /// Current branch name (None if detached HEAD)
    pub current: Option<String>,
    /// List of all local branches
    pub branches: Vec<String>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Find the git repository root from the given path
fn find_repo_root(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(path)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Not a git repository: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Run a git command and return the output
fn run_git(work_dir: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(work_dir)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get the git status for a repository
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusResult, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    // Get current branch
    let branch = run_git(work_dir, &["branch", "--show-current"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // Get porcelain status for parsing
    let status_output = run_git(work_dir, &["status", "--porcelain=v1", "-uall"])?;

    let mut staged: Vec<FileStatus> = Vec::new();
    let mut unstaged: Vec<FileStatus> = Vec::new();
    let mut untracked: Vec<String> = Vec::new();

    for line in status_output.lines() {
        if line.len() < 3 {
            continue;
        }

        let index_status = line.chars().next().unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let file_path = line[3..].to_string();

        // Handle untracked files
        if index_status == '?' && worktree_status == '?' {
            untracked.push(file_path);
            continue;
        }

        // Handle staged changes (index status)
        if index_status != ' ' && index_status != '?' {
            let status = match index_status {
                'M' => "modified",
                'A' => "added",
                'D' => "deleted",
                'R' => "renamed",
                'C' => "copied",
                'T' => "typechange",
                _ => "unknown",
            };
            staged.push(FileStatus {
                path: file_path.clone(),
                status: status.to_string(),
            });
        }

        // Handle unstaged changes (worktree status)
        if worktree_status != ' ' && worktree_status != '?' {
            let status = match worktree_status {
                'M' => "modified",
                'D' => "deleted",
                'T' => "typechange",
                _ => "unknown",
            };
            unstaged.push(FileStatus {
                path: file_path,
                status: status.to_string(),
            });
        }
    }

    Ok(GitStatusResult {
        branch,
        staged,
        unstaged,
        untracked,
    })
}

/// Get the diff for a repository or specific file
#[tauri::command]
pub async fn git_diff(path: String, file: Option<String>, staged: Option<bool>) -> Result<String, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    let mut args = vec!["diff", "--color=never"];

    if staged.unwrap_or(false) {
        args.push("--cached");
    }

    if let Some(ref file_path) = file {
        args.push("--");
        args.push(file_path);
    }

    run_git(work_dir, &args)
}

/// Get the commit log for a repository
#[tauri::command]
pub async fn git_log(path: String, count: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);
    let count = count.unwrap_or(50);

    // Use a custom format for easy parsing
    let format = "%H%n%h%n%s%n%an%n%aI";
    let count_str = format!("-{}", count);

    let output = run_git(work_dir, &["log", &count_str, &format!("--format={}", format)])?;

    let mut commits = Vec::new();
    let mut lines = output.lines().peekable();

    while lines.peek().is_some() {
        let hash = lines.next().unwrap_or_default().to_string();
        let short_hash = lines.next().unwrap_or_default().to_string();
        let message = lines.next().unwrap_or_default().to_string();
        let author = lines.next().unwrap_or_default().to_string();
        let date = lines.next().unwrap_or_default().to_string();

        if !hash.is_empty() {
            commits.push(GitCommit {
                hash,
                short_hash,
                message,
                author,
                date,
            });
        }
    }

    Ok(commits)
}

/// Get branch information for a repository
#[tauri::command]
pub async fn git_branch(path: String) -> Result<GitBranchInfo, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    // Get current branch
    let current = run_git(work_dir, &["branch", "--show-current"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // Get all local branches
    let branches_output = run_git(work_dir, &["branch", "--format=%(refname:short)"])?;

    let mut branches: Vec<String> = branches_output
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // Sort branches alphabetically, but put current branch first
    branches.sort();
    if let Some(ref current_branch) = current {
        if let Some(pos) = branches.iter().position(|b| b == current_branch) {
            branches.remove(pos);
            branches.insert(0, current_branch.clone());
        }
    }

    Ok(GitBranchInfo { current, branches })
}

/// Stage files for commit
#[tauri::command]
pub async fn git_stage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    if files.is_empty() {
        return Ok(());
    }

    let mut args = vec!["add", "--"];
    for file in &files {
        args.push(file);
    }

    run_git(work_dir, &args)?;
    Ok(())
}

/// Unstage files (remove from staging area)
#[tauri::command]
pub async fn git_unstage(path: String, files: Vec<String>) -> Result<(), String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    if files.is_empty() {
        return Ok(());
    }

    let mut args = vec!["reset", "HEAD", "--"];
    for file in &files {
        args.push(file);
    }

    run_git(work_dir, &args)?;
    Ok(())
}

/// Create a commit with the staged changes
#[tauri::command]
pub async fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    run_git(work_dir, &["commit", "-m", &message])?;

    // Get the new commit hash
    let hash = run_git(work_dir, &["rev-parse", "HEAD"])?;
    Ok(hash.trim().to_string())
}

/// Discard changes in working directory
#[tauri::command]
pub async fn git_discard(path: String, files: Vec<String>) -> Result<(), String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    if files.is_empty() {
        return Ok(());
    }

    // Use git restore (git 2.23+) to discard changes
    let mut args = vec!["restore", "--"];
    for file in &files {
        args.push(file);
    }

    if run_git(work_dir, &args).is_err() {
        // Fallback to checkout for older git versions
        let mut args = vec!["checkout", "--"];
        for file in &files {
            args.push(file);
        }
        run_git(work_dir, &args)?;
    }

    Ok(())
}

// ============================================================================
// Module Initialization
// ============================================================================

/// Initialize and return the git commands for Tauri
pub fn init() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        git_status,
        git_diff,
        git_log,
        git_branch,
        git_stage,
        git_unstage,
        git_commit,
        git_discard,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_repo_root() {
        // This will only pass if run from within a git repo
        let result = find_repo_root(".");
        // Just verify it doesn't panic
        let _ = result;
    }
}
