//! Git status tracking

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// File status in the working tree
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileStatus {
    /// File is untracked
    Untracked,
    /// File is modified
    Modified,
    /// File is added (staged)
    Added,
    /// File is deleted
    Deleted,
    /// File is renamed
    Renamed,
    /// File is copied
    Copied,
    /// File has merge conflicts
    Conflicted,
}

/// Status entry for a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusEntry {
    /// File path relative to repository root
    pub path: PathBuf,

    /// Status in the index (staging area)
    pub index_status: Option<FileStatus>,

    /// Status in the working tree
    pub worktree_status: Option<FileStatus>,
}

impl StatusEntry {
    /// Check if the file is staged
    pub fn is_staged(&self) -> bool {
        self.index_status.is_some()
    }

    /// Check if the file has unstaged changes
    pub fn has_unstaged_changes(&self) -> bool {
        self.worktree_status.is_some()
    }
}

/// Repository status summary
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StatusSummary {
    /// Files with changes
    pub entries: Vec<StatusEntry>,

    /// Current branch name
    pub branch: Option<String>,

    /// Number of commits ahead of upstream
    pub ahead: u32,

    /// Number of commits behind upstream
    pub behind: u32,
}
