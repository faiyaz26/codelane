//! Git diff computation

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

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
