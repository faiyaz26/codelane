//! Git diff computation

use std::path::PathBuf;
use gix::bstr::ByteSlice;
use gix::prelude::*;
use imara_diff::intern::InternedInput;
use imara_diff::{Algorithm, UnifiedDiffBuilder};
use serde::{Deserialize, Serialize};
use crate::{Error, Result};

/// Change type for a diff hunk
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChangeType {
    /// Lines were added
    Added,
    /// Lines were removed
    Removed,
    /// Lines were modified
    Modified,
    /// Context (unchanged) lines
    Context,
}

/// A single line in a diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    /// Line content
    pub content: String,

    /// Original line number (None for added lines)
    pub old_line: Option<u32>,

    /// New line number (None for removed lines)
    pub new_line: Option<u32>,

    /// Change type
    pub change_type: ChangeType,
}

/// A diff hunk (contiguous block of changes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    /// Starting line in the old file
    pub old_start: u32,

    /// Number of lines in the old file
    pub old_lines: u32,

    /// Starting line in the new file
    pub new_start: u32,

    /// Number of lines in the new file
    pub new_lines: u32,

    /// Lines in this hunk
    pub lines: Vec<DiffLine>,

    /// AI-generated explanation (optional)
    pub explanation: Option<String>,
}

/// Diff for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    /// File path
    pub path: PathBuf,

    /// Old path (if renamed)
    pub old_path: Option<PathBuf>,

    /// Overall change type
    pub change_type: FileChangeType,

    /// Diff hunks
    pub hunks: Vec<DiffHunk>,

    /// Is this a binary file?
    pub is_binary: bool,
}

/// File-level change type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileChangeType {
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
}

/// Complete diff result
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiffResult {
    /// Files with changes
    pub files: Vec<FileDiff>,

    /// Total lines added
    pub additions: u32,

    /// Total lines deleted
    pub deletions: u32,
}

pub fn compute_diff(repo: &gix::Repository, file: Option<&str>, staged: bool) -> Result<String> {
    let mut diff_output = String::new();

    if staged {
        // For staged diff, we currently fall back to CLI because tree-index diff
        // in gix 0.68 is complex to implement correctly with all edge cases (renames, etc.)
        return Err(Error::Git("Native gix staged diff not yet implemented, falling back to CLI".to_string()));
    }

    // Worktree vs Index (unstaged changes)
    let index = repo.index().map_err(|e| Error::Git(e.to_string()))?;
    let status_platform = repo.status(gix::progress::Discard).map_err(|e| Error::Git(e.to_string()))?;
    
    let items = status_platform
        .index(gix::worktree::IndexPersistedOrInMemory::Persisted(index))
        .into_index_worktree_iter(Vec::<gix::bstr::BString>::new())
        .map_err(|e| Error::Git(e.to_string()))?;

    let mut buffer = Vec::new();
    for item in items {
        let item = item.map_err(|e| Error::Git(e.to_string()))?;
        match item {
            gix::status::index_worktree::iter::Item::Modification { rela_path, entry, .. } => {
                let location = rela_path.to_string();
                if let Some(f) = file {
                    if location != f {
                        continue;
                    }
                }

                // Get old content from index
                let old_blob = repo.objects.find_blob(&entry.id, &mut buffer).map_err(|e| Error::Git(e.to_string()))?;
                let old_content = old_blob.data.as_bstr().to_str_lossy();
                
                // Get new content from worktree
                let full_path = repo.work_dir().expect("worktree required").join(&location);
                let new_content_bytes = std::fs::read(&full_path).unwrap_or_default();
                let new_content = new_content_bytes.as_bstr().to_str_lossy();

                let input = InternedInput::new(old_content.as_ref(), new_content.as_ref());
                
                diff_output.push_str(&format!("diff --git a/{location} b/{location}\n"));
                diff_output.push_str(&format!("--- a/{location}\n"));
                diff_output.push_str(&format!("+++ b/{location}\n"));

                let diff = imara_diff::diff(Algorithm::Histogram, &input, UnifiedDiffBuilder::new(&input));
                diff_output.push_str(&diff);
            }
            _ => {}
        }
    }

    if diff_output.is_empty() {
        return Err(Error::Git("No changes found".to_string()));
    }

    Ok(diff_output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::TempDir;

    fn create_test_repo() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let path = temp_dir.path();

        Command::new("git")
            .current_dir(path)
            .args(["init"])
            .output()
            .expect("Failed to init git repo");

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

    #[test]
    fn test_compute_diff_modified() {
        let temp = create_test_repo();
        let file_path = temp.path().join("file.txt");
        fs::write(&file_path, "line1\nline2\nline3\n").unwrap();

        Command::new("git")
            .current_dir(temp.path())
            .args(["add", "file.txt"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(temp.path())
            .args(["commit", "-m", "initial"])
            .output()
            .unwrap();

        // Ensure mtime changes
        std::thread::sleep(std::time::Duration::from_millis(1100));

        fs::write(&file_path, "line1\nline2 modified\nline3\n").unwrap();

        let repo = gix::open(temp.path()).unwrap();
        let diff = compute_diff(&repo, None, false).unwrap();

        assert!(diff.contains("diff --git a/file.txt b/file.txt"));
        assert!(diff.contains("-line2"));
        assert!(diff.contains("+line2 modified"));
    }

    #[test]
    fn test_compute_diff_specific_file() {
        let temp = create_test_repo();
        let file1 = temp.path().join("file1.txt");
        let file2 = temp.path().join("file2.txt");
        fs::write(&file1, "content1").unwrap();
        fs::write(&file2, "content2").unwrap();

        Command::new("git")
            .current_dir(temp.path())
            .args(["add", "file1.txt", "file2.txt"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(temp.path())
            .args(["commit", "-m", "initial"])
            .output()
            .unwrap();

        std::thread::sleep(std::time::Duration::from_millis(1100));

        fs::write(&file1, "modified1").unwrap();
        fs::write(&file2, "modified2").unwrap();

        let repo = gix::open(temp.path()).unwrap();
        
        // Diff only file1
        let diff = compute_diff(&repo, Some("file1.txt"), false).unwrap();
        assert!(diff.contains("file1.txt"));
        assert!(!diff.contains("file2.txt"));
    }
}
