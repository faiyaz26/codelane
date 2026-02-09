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

/// File change with statistics
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct FileChangeStats {
    /// File path relative to repository root
    pub path: String,
    /// Status type: "modified", "added", "deleted", "renamed", "copied"
    pub status: String,
    /// Number of lines added
    pub additions: u32,
    /// Number of lines deleted
    pub deletions: u32,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Validate that a path is inside a git repository or worktree
/// Returns the path as-is if valid (for worktree support)
fn validate_git_path(path: &str) -> Result<String, String> {
    let work_dir = Path::new(path);

    if !work_dir.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Check if we're inside a git work tree (works for both repos and worktrees)
    let output = Command::new("git")
        .current_dir(path)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Not a git repository: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Return the original path - this is important for worktree support
    // We want to run git commands from the worktree directory, not the main repo
    Ok(path.to_string())
}

/// Find the git repository root from the given path
/// Note: For worktrees, this returns the MAIN repo root, not the worktree path
/// Use validate_git_path() instead when you want to work within a worktree
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

/// Get the git status for a repository or worktree
#[tauri::command]
pub async fn git_status(path: String) -> Result<GitStatusResult, String> {
    // Use validate_git_path to support worktrees - run git from the passed path
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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

/// Get the diff for a repository/worktree or specific file
#[tauri::command]
pub async fn git_diff(path: String, file: Option<String>, staged: Option<bool>) -> Result<String, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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

/// Get file content at a specific revision
#[tauri::command]
pub async fn git_show_file(path: String, file: String, revision: Option<String>) -> Result<String, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

    let rev = revision.unwrap_or_else(|| "HEAD".to_string());
    let file_spec = format!("{}:{}", rev, file);

    let args = vec!["show", &file_spec];
    run_git(work_dir, &args)
}

/// Get all changed files with line statistics
#[tauri::command]
pub async fn git_changes_with_stats(path: String) -> Result<Vec<FileChangeStats>, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

    // Get status to know which files changed
    let status = git_status(path.clone()).await?;

    let mut changes = Vec::new();

    // Process staged files
    for file_status in &status.staged {
        let stats = get_file_stats(work_dir, &file_status.path, true)?;
        changes.push(FileChangeStats {
            path: file_status.path.clone(),
            status: file_status.status.clone(),
            additions: stats.0,
            deletions: stats.1,
        });
    }

    // Process unstaged files
    for file_status in &status.unstaged {
        let stats = get_file_stats(work_dir, &file_status.path, false)?;
        changes.push(FileChangeStats {
            path: file_status.path.clone(),
            status: file_status.status.clone(),
            additions: stats.0,
            deletions: stats.1,
        });
    }

    // Process untracked files (all additions)
    for file_path in &status.untracked {
        // Count lines in the file
        let file_full_path = work_dir.join(file_path);
        let additions = if file_full_path.exists() {
            std::fs::read_to_string(&file_full_path)
                .map(|content| content.lines().count() as u32)
                .unwrap_or(0)
        } else {
            0
        };

        changes.push(FileChangeStats {
            path: file_path.clone(),
            status: "added".to_string(),
            additions,
            deletions: 0,
        });
    }

    Ok(changes)
}

/// Get files changed in a specific commit with statistics
#[tauri::command]
pub async fn git_commit_changes(path: String, commit_hash: String) -> Result<Vec<FileChangeStats>, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

    // Get the list of files changed in this commit with numstat
    let args = vec!["show", "--numstat", "--format=", &commit_hash];
    let output = run_git(work_dir, &args)?;

    let mut changes = Vec::new();

    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }

        // Format: <additions>\t<deletions>\t<filename>
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() != 3 {
            continue;
        }

        let additions = parts[0].parse::<u32>().unwrap_or(0);
        let deletions = parts[1].parse::<u32>().unwrap_or(0);
        let path = parts[2].to_string();

        // Determine status by checking if file exists in parent commit
        let status = if additions > 0 && deletions == 0 {
            "added"
        } else if additions == 0 && deletions > 0 {
            "deleted"
        } else {
            "modified"
        };

        changes.push(FileChangeStats {
            path,
            status: status.to_string(),
            additions,
            deletions,
        });
    }

    Ok(changes)
}

/// Maximum number of files to apply dependency analysis to prevent performance degradation
const MAX_FILES_FOR_DEPENDENCY_ANALYSIS: usize = 50;

/// Sort files according to the specified order
#[tauri::command]
pub async fn git_sort_files(
    files: Vec<FileChangeStats>,
    sort_order: String,
    working_dir: Option<String>,
) -> Result<Vec<FileChangeStats>, String> {
    use crate::file_sorter;
    use std::collections::HashMap;

    let sorted_files = match sort_order.as_str() {
        "smart" => file_sorter::sort_files_smart(files),
        "smart-dependencies" => {
            // Performance guard: Only do dependency analysis for reasonable file counts
            if files.len() > MAX_FILES_FOR_DEPENDENCY_ANALYSIS {
                // Fall back to regular smart sort for large changesets
                eprintln!(
                    "Too many files ({}) for dependency analysis, falling back to smart sort",
                    files.len()
                );
                file_sorter::sort_files_smart(files)
            } else {
                // For dependency-aware sorting, we need file contents
                let work_dir = working_dir.ok_or("working_dir required for smart-dependencies sorting")?;
                let work_path = Path::new(&work_dir);

                // Read file contents for supported languages only
                let mut file_contents = HashMap::new();
                for file in &files {
                    let file_path = work_path.join(&file.path);
                    if let Ok(content) = std::fs::read_to_string(&file_path) {
                        file_contents.insert(file.path.clone(), content);
                    }
                }

                file_sorter::sort_files_smart_dependencies(files, file_contents)
            }
        }
        "alphabetical" => file_sorter::sort_files_alphabetical(files),
        "change-size" => file_sorter::sort_files_by_size(files),
        "none" => files, // No sorting
        _ => return Err(format!("Unknown sort order: {}", sort_order)),
    };

    Ok(sorted_files)
}

/// Helper function to get line statistics for a file
fn get_file_stats(work_dir: &Path, file_path: &str, staged: bool) -> Result<(u32, u32), String> {
    let mut args = vec!["diff", "--numstat", "--color=never"];

    if staged {
        args.push("--cached");
    }

    args.push("--");
    args.push(file_path);

    let output = run_git(work_dir, &args)?;

    // Parse numstat output: "additions\tdeletions\tfilename"
    if let Some(line) = output.lines().next() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 {
            let additions = parts[0].parse::<u32>().unwrap_or(0);
            let deletions = parts[1].parse::<u32>().unwrap_or(0);
            return Ok((additions, deletions));
        }
    }

    Ok((0, 0))
}

/// Get the commit log for a repository or worktree
#[tauri::command]
pub async fn git_log(path: String, count: Option<u32>) -> Result<Vec<GitCommit>, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);
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

/// Get branch information for a repository or worktree
#[tauri::command]
pub async fn git_branch(path: String) -> Result<GitBranchInfo, String> {
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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
    let git_path = validate_git_path(&path)?;
    let work_dir = Path::new(&git_path);

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
// Worktree Commands
// ============================================================================

/// Initialize a new git repository
#[tauri::command]
pub async fn git_init(path: String) -> Result<(), String> {
    let work_dir = Path::new(&path);

    if !work_dir.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    run_git(work_dir, &["init"])?;
    Ok(())
}

/// Check if a directory is a git repository
#[tauri::command]
pub async fn git_is_repo(path: String) -> Result<bool, String> {
    let work_dir = Path::new(&path);

    if !work_dir.exists() {
        return Ok(false);
    }

    let output = Command::new("git")
        .current_dir(work_dir)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    Ok(output.status.success())
}

/// Check if a branch exists in the repository
#[tauri::command]
pub async fn git_branch_exists(path: String, branch: String) -> Result<bool, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    let output = Command::new("git")
        .current_dir(work_dir)
        .args(["rev-parse", "--verify", &format!("refs/heads/{}", branch)])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    Ok(output.status.success())
}

/// Create a new branch from the current HEAD
#[tauri::command]
pub async fn git_create_branch(path: String, branch: String) -> Result<(), String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    run_git(work_dir, &["branch", &branch])?;
    Ok(())
}

/// Compute the global worktree path for a project and branch.
/// Worktrees are stored in ~/.codelane/<env>/worktrees/<project-name>/<branch>/
/// This keeps them outside the project directory to avoid tooling conflicts
/// (ESLint, TypeScript, etc. walking up the directory tree).
fn get_worktree_path(repo_root: &Path, branch: &str) -> Result<std::path::PathBuf, String> {
    // Get project name from repo root
    let project_name = repo_root
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Could not determine project name from repository path")?;

    Ok(crate::paths::worktree_path(project_name, branch))
}

/// Create a git worktree
/// Returns the path where the worktree was created
#[tauri::command]
pub async fn git_worktree_add(path: String, branch: String) -> Result<String, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    // Compute worktree path in global location
    let worktree_path = get_worktree_path(work_dir, &branch)?;
    let worktree_path_str = worktree_path.to_string_lossy().to_string();

    // Create parent directory if it doesn't exist
    if let Some(parent) = worktree_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create worktree directory: {}", e))?;
    }

    run_git(work_dir, &["worktree", "add", &worktree_path_str, &branch])?;
    Ok(worktree_path_str)
}

/// Information about a git worktree
#[derive(Debug, Clone, Serialize)]
pub struct WorktreeInfo {
    /// Path to the worktree directory
    pub path: String,
    /// HEAD commit hash
    pub head: String,
    /// Branch name (if checked out to a branch)
    pub branch: Option<String>,
    /// Whether this is the main worktree
    pub is_main: bool,
}

/// List all git worktrees for a repository
#[tauri::command]
pub async fn git_worktree_list(path: String) -> Result<Vec<WorktreeInfo>, String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    let output = run_git(work_dir, &["worktree", "list", "--porcelain"])?;

    let mut worktrees = Vec::new();
    let mut current_worktree: Option<WorktreeInfo> = None;

    for line in output.lines() {
        if line.starts_with("worktree ") {
            // Save previous worktree if exists
            if let Some(wt) = current_worktree.take() {
                worktrees.push(wt);
            }
            // Start new worktree
            current_worktree = Some(WorktreeInfo {
                path: line.strip_prefix("worktree ").unwrap_or("").to_string(),
                head: String::new(),
                branch: None,
                is_main: false,
            });
        } else if line.starts_with("HEAD ") {
            if let Some(ref mut wt) = current_worktree {
                wt.head = line.strip_prefix("HEAD ").unwrap_or("").to_string();
            }
        } else if line.starts_with("branch ") {
            if let Some(ref mut wt) = current_worktree {
                let branch = line.strip_prefix("branch refs/heads/").unwrap_or(
                    line.strip_prefix("branch ").unwrap_or("")
                );
                wt.branch = Some(branch.to_string());
            }
        } else if line == "bare" {
            // Main/bare worktree indicator - mark as main
            if let Some(ref mut wt) = current_worktree {
                wt.is_main = true;
            }
        }
    }

    // Don't forget the last worktree
    if let Some(wt) = current_worktree {
        worktrees.push(wt);
    }

    // Mark the first worktree as main (it's the original repo)
    if let Some(first) = worktrees.first_mut() {
        first.is_main = true;
    }

    Ok(worktrees)
}

/// Remove a git worktree
#[tauri::command]
pub async fn git_worktree_remove(path: String, worktree_path: String) -> Result<(), String> {
    let repo_root = find_repo_root(&path)?;
    let work_dir = Path::new(&repo_root);

    // First try to remove with --force to handle any edge cases
    let result = run_git(work_dir, &["worktree", "remove", "--force", &worktree_path]);

    if result.is_err() {
        // If that fails, try without --force
        run_git(work_dir, &["worktree", "remove", &worktree_path])?;
    }

    // Clean up the parent directory if empty
    let worktree_dir = Path::new(&worktree_path);
    if let Some(parent) = worktree_dir.parent() {
        // Try to remove the parent dir (will only succeed if empty)
        let _ = std::fs::remove_dir(parent);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Helper to create a temporary git repository for testing
    fn create_test_repo() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let path = temp_dir.path();

        // Initialize git repo
        Command::new("git")
            .current_dir(path)
            .args(["init"])
            .output()
            .expect("Failed to init git repo");

        // Configure git user for commits
        Command::new("git")
            .current_dir(path)
            .args(["config", "user.email", "test@test.com"])
            .output()
            .expect("Failed to set git email");

        Command::new("git")
            .current_dir(path)
            .args(["config", "user.name", "Test User"])
            .output()
            .expect("Failed to set git name");

        temp_dir
    }

    /// Helper to create a file in the test repo
    fn create_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        fs::write(file_path, content).expect("Failed to write file");
    }

    /// Helper to run git command in test repo
    fn git_cmd(dir: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .current_dir(dir)
            .args(args)
            .output()
            .expect("Failed to run git command");
        String::from_utf8_lossy(&output.stdout).to_string()
    }

    // =========================================================================
    // find_repo_root tests
    // =========================================================================

    #[test]
    fn test_find_repo_root_valid_repo() {
        let temp = create_test_repo();
        let result = find_repo_root(temp.path().to_str().unwrap());
        assert!(result.is_ok());
        // Canonicalize paths for comparison (handles macOS /var vs /private/var)
        let expected = temp.path().canonicalize().unwrap();
        let actual = Path::new(&result.unwrap()).canonicalize().unwrap();
        assert_eq!(actual, expected);
    }

    #[test]
    fn test_find_repo_root_subdirectory() {
        let temp = create_test_repo();
        let subdir = temp.path().join("subdir");
        fs::create_dir(&subdir).expect("Failed to create subdir");

        let result = find_repo_root(subdir.to_str().unwrap());
        assert!(result.is_ok());
        // Canonicalize paths for comparison (handles macOS /var vs /private/var)
        let expected = temp.path().canonicalize().unwrap();
        let actual = Path::new(&result.unwrap()).canonicalize().unwrap();
        assert_eq!(actual, expected);
    }

    #[test]
    fn test_find_repo_root_not_a_repo() {
        let temp = TempDir::new().expect("Failed to create temp dir");
        let result = find_repo_root(temp.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a git repository"));
    }

    // =========================================================================
    // validate_git_path tests
    // =========================================================================

    #[test]
    fn test_validate_git_path_valid_repo() {
        let temp = create_test_repo();
        let result = validate_git_path(temp.path().to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_git_path_nonexistent() {
        let result = validate_git_path("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path does not exist"));
    }

    #[test]
    fn test_validate_git_path_not_a_repo() {
        let temp = TempDir::new().expect("Failed to create temp dir");
        let result = validate_git_path(temp.path().to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a git repository"));
    }

    // =========================================================================
    // run_git tests
    // =========================================================================

    #[test]
    fn test_run_git_valid_command() {
        let temp = create_test_repo();
        let result = run_git(temp.path(), &["status"]);
        assert!(result.is_ok());
    }

    #[test]
    fn test_run_git_invalid_command() {
        let temp = create_test_repo();
        let result = run_git(temp.path(), &["not-a-real-command"]);
        assert!(result.is_err());
    }

    // =========================================================================
    // get_worktree_path tests
    // =========================================================================

    #[test]
    fn test_get_worktree_path_simple_branch() {
        let temp = create_test_repo();
        let result = get_worktree_path(temp.path(), "feature-branch");
        assert!(result.is_ok());

        let path = result.unwrap();
        let path_str = path.to_string_lossy();

        // Should contain .codelane/<env>/worktrees
        assert!(path_str.contains(".codelane/dev/worktrees"));
        // Should contain the branch name
        assert!(path_str.contains("feature-branch"));
    }

    #[test]
    fn test_get_worktree_path_branch_with_slash() {
        let temp = create_test_repo();
        let result = get_worktree_path(temp.path(), "feature/my-feature");
        assert!(result.is_ok());

        let path = result.unwrap();
        let path_str = path.to_string_lossy();

        // Slash should be replaced with dash
        assert!(path_str.contains("feature-my-feature"));
        assert!(!path_str.contains("feature/my-feature"));
    }

    // =========================================================================
    // git_status parsing tests
    // =========================================================================

    #[test]
    fn test_git_status_empty_repo() {
        let temp = create_test_repo();

        // Use tokio runtime for async test
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.staged.is_empty());
        assert!(status.unstaged.is_empty());
        assert!(status.untracked.is_empty());
    }

    #[test]
    fn test_git_status_untracked_file() {
        let temp = create_test_repo();
        create_file(temp.path(), "new_file.txt", "content");

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.staged.is_empty());
        assert!(status.unstaged.is_empty());
        assert_eq!(status.untracked.len(), 1);
        assert!(status.untracked.contains(&"new_file.txt".to_string()));
    }

    #[test]
    fn test_git_status_staged_file() {
        let temp = create_test_repo();
        create_file(temp.path(), "staged.txt", "content");
        git_cmd(temp.path(), &["add", "staged.txt"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "staged.txt");
        assert_eq!(status.staged[0].status, "added");
        assert!(status.unstaged.is_empty());
        assert!(status.untracked.is_empty());
    }

    #[test]
    fn test_git_status_modified_file() {
        let temp = create_test_repo();

        // Create, stage, and commit a file
        create_file(temp.path(), "file.txt", "original");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        // Modify the file
        create_file(temp.path(), "file.txt", "modified");

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.staged.is_empty());
        assert_eq!(status.unstaged.len(), 1);
        assert_eq!(status.unstaged[0].path, "file.txt");
        assert_eq!(status.unstaged[0].status, "modified");
    }

    #[test]
    fn test_git_status_deleted_file() {
        let temp = create_test_repo();

        // Create, stage, and commit a file
        create_file(temp.path(), "to_delete.txt", "content");
        git_cmd(temp.path(), &["add", "to_delete.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        // Delete the file
        fs::remove_file(temp.path().join("to_delete.txt")).expect("Failed to delete file");

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.staged.is_empty());
        assert_eq!(status.unstaged.len(), 1);
        assert_eq!(status.unstaged[0].path, "to_delete.txt");
        assert_eq!(status.unstaged[0].status, "deleted");
    }

    #[test]
    fn test_git_status_branch_name() {
        let temp = create_test_repo();

        // Create initial commit (needed for branch to show)
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let status = result.unwrap();
        // Default branch is usually "main" or "master"
        assert!(status.branch.is_some());
    }

    // =========================================================================
    // git_is_repo tests
    // =========================================================================

    #[test]
    fn test_git_is_repo_true() {
        let temp = create_test_repo();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_is_repo(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_git_is_repo_false() {
        let temp = TempDir::new().expect("Failed to create temp dir");

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_is_repo(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_git_is_repo_nonexistent_path() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_is_repo("/nonexistent/path".to_string()));

        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    // =========================================================================
    // git_branch tests
    // =========================================================================

    #[test]
    fn test_git_branch_info() {
        let temp = create_test_repo();

        // Create initial commit
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        // Create another branch
        git_cmd(temp.path(), &["branch", "feature-branch"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_branch(temp.path().to_str().unwrap().to_string()));

        assert!(result.is_ok());
        let info = result.unwrap();
        assert!(info.current.is_some());
        assert!(info.branches.len() >= 2); // At least main/master and feature-branch
        assert!(info.branches.contains(&"feature-branch".to_string()));
    }

    // =========================================================================
    // git_branch_exists tests
    // =========================================================================

    #[test]
    fn test_git_branch_exists_true() {
        let temp = create_test_repo();

        // Create initial commit and branch
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);
        git_cmd(temp.path(), &["branch", "test-branch"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_branch_exists(
            temp.path().to_str().unwrap().to_string(),
            "test-branch".to_string(),
        ));

        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_git_branch_exists_false() {
        let temp = create_test_repo();

        // Create initial commit
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_branch_exists(
            temp.path().to_str().unwrap().to_string(),
            "nonexistent-branch".to_string(),
        ));

        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    // =========================================================================
    // git_create_branch tests
    // =========================================================================

    #[test]
    fn test_git_create_branch() {
        let temp = create_test_repo();

        // Create initial commit
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        let rt = tokio::runtime::Runtime::new().unwrap();

        // Create new branch
        let result = rt.block_on(git_create_branch(
            temp.path().to_str().unwrap().to_string(),
            "new-branch".to_string(),
        ));
        assert!(result.is_ok());

        // Verify it exists
        let exists = rt.block_on(git_branch_exists(
            temp.path().to_str().unwrap().to_string(),
            "new-branch".to_string(),
        ));
        assert!(exists.is_ok());
        assert!(exists.unwrap());
    }

    // =========================================================================
    // git_commit tests
    // =========================================================================

    #[test]
    fn test_git_commit_success() {
        let temp = create_test_repo();

        // Stage a file
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_commit(
            temp.path().to_str().unwrap().to_string(),
            "Test commit message".to_string(),
        ));

        assert!(result.is_ok());
        // Should return a commit hash
        let hash = result.unwrap();
        assert!(!hash.is_empty());
        assert_eq!(hash.len(), 40); // Git SHA-1 hash length
    }

    #[test]
    fn test_git_commit_empty_message() {
        let temp = create_test_repo();

        // Stage a file
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_commit(
            temp.path().to_str().unwrap().to_string(),
            "".to_string(),
        ));

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
    }

    // =========================================================================
    // git_stage and git_unstage tests
    // =========================================================================

    #[test]
    fn test_git_stage_files() {
        let temp = create_test_repo();

        // Create untracked files
        create_file(temp.path(), "file1.txt", "content1");
        create_file(temp.path(), "file2.txt", "content2");

        let rt = tokio::runtime::Runtime::new().unwrap();

        // Stage one file
        let result = rt.block_on(git_stage(
            temp.path().to_str().unwrap().to_string(),
            vec!["file1.txt".to_string()],
        ));
        assert!(result.is_ok());

        // Check status - file1 should be staged
        let status = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));
        assert!(status.is_ok());
        let status = status.unwrap();
        assert_eq!(status.staged.len(), 1);
        assert_eq!(status.staged[0].path, "file1.txt");
        assert!(status.untracked.contains(&"file2.txt".to_string()));
    }

    #[test]
    fn test_git_unstage_files() {
        let temp = create_test_repo();

        // Create and stage a file
        create_file(temp.path(), "file.txt", "content");
        git_cmd(temp.path(), &["add", "file.txt"]);

        let rt = tokio::runtime::Runtime::new().unwrap();

        // Unstage the file
        let result = rt.block_on(git_unstage(
            temp.path().to_str().unwrap().to_string(),
            vec!["file.txt".to_string()],
        ));
        assert!(result.is_ok());

        // Check status - file should be untracked again
        let status = rt.block_on(git_status(temp.path().to_str().unwrap().to_string()));
        assert!(status.is_ok());
        let status = status.unwrap();
        assert!(status.staged.is_empty());
        assert!(status.untracked.contains(&"file.txt".to_string()));
    }

    // =========================================================================
    // git_log tests
    // =========================================================================

    #[test]
    fn test_git_log() {
        let temp = create_test_repo();

        // Create multiple commits
        create_file(temp.path(), "file1.txt", "content1");
        git_cmd(temp.path(), &["add", "file1.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "First commit"]);

        create_file(temp.path(), "file2.txt", "content2");
        git_cmd(temp.path(), &["add", "file2.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Second commit"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_log(temp.path().to_str().unwrap().to_string(), Some(10)));

        assert!(result.is_ok());
        let commits = result.unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].message, "Second commit");
        assert_eq!(commits[1].message, "First commit");
        assert!(!commits[0].hash.is_empty());
        assert_eq!(commits[0].short_hash.len(), 7);
    }

    // =========================================================================
    // git_diff tests
    // =========================================================================

    #[test]
    fn test_git_diff_unstaged() {
        let temp = create_test_repo();

        // Create and commit a file
        create_file(temp.path(), "file.txt", "original");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        // Modify the file
        create_file(temp.path(), "file.txt", "modified content");

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_diff(
            temp.path().to_str().unwrap().to_string(),
            None,
            None,
        ));

        assert!(result.is_ok());
        let diff = result.unwrap();
        assert!(diff.contains("-original"));
        assert!(diff.contains("+modified content"));
    }

    #[test]
    fn test_git_diff_staged() {
        let temp = create_test_repo();

        // Create and commit a file
        create_file(temp.path(), "file.txt", "original");
        git_cmd(temp.path(), &["add", "file.txt"]);
        git_cmd(temp.path(), &["commit", "-m", "Initial commit"]);

        // Modify and stage
        create_file(temp.path(), "file.txt", "staged change");
        git_cmd(temp.path(), &["add", "file.txt"]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(git_diff(
            temp.path().to_str().unwrap().to_string(),
            None,
            Some(true),
        ));

        assert!(result.is_ok());
        let diff = result.unwrap();
        assert!(diff.contains("-original"));
        assert!(diff.contains("+staged change"));
    }

    // =========================================================================
    // Serialization tests
    // =========================================================================

    #[test]
    fn test_git_status_result_serialization() {
        let status = GitStatusResult {
            branch: Some("main".to_string()),
            staged: vec![FileStatus {
                path: "file.txt".to_string(),
                status: "added".to_string(),
            }],
            unstaged: vec![],
            untracked: vec!["new.txt".to_string()],
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"branch\":\"main\""));
        assert!(json.contains("\"staged\""));
        assert!(json.contains("\"untracked\""));
    }

    #[test]
    fn test_git_commit_serialization() {
        let commit = GitCommit {
            hash: "abc123def456".to_string(),
            short_hash: "abc123d".to_string(),
            message: "Test commit".to_string(),
            author: "Test User".to_string(),
            date: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&commit).unwrap();
        assert!(json.contains("\"hash\":\"abc123def456\""));
        assert!(json.contains("\"message\":\"Test commit\""));
    }

    #[test]
    fn test_worktree_info_serialization() {
        let info = WorktreeInfo {
            path: "/path/to/worktree".to_string(),
            head: "abc123".to_string(),
            branch: Some("feature".to_string()),
            is_main: false,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"path\":\"/path/to/worktree\""));
        assert!(json.contains("\"branch\":\"feature\""));
        assert!(json.contains("\"is_main\":false"));
    }
}
