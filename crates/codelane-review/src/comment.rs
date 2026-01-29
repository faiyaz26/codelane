//! Review comments

use codelane_core::CommentId;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A review comment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    /// Unique identifier
    pub id: CommentId,

    /// File path the comment is on
    pub path: PathBuf,

    /// Line number (1-indexed)
    pub line: u32,

    /// Comment content (markdown)
    pub content: String,

    /// Is this comment resolved?
    pub resolved: bool,

    /// Created timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
}
