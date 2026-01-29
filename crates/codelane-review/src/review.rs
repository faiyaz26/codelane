//! Review model

use codelane_core::{LaneId, ReviewId};
use serde::{Deserialize, Serialize};

/// Review status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReviewStatus {
    /// Review is in progress
    InProgress,
    /// Changes approved
    Approved,
    /// Changes requested
    ChangesRequested,
    /// Review dismissed
    Dismissed,
}

/// A code review
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Review {
    /// Unique identifier
    pub id: ReviewId,

    /// Lane this review belongs to
    pub lane_id: LaneId,

    /// Review title
    pub title: String,

    /// Current status
    pub status: ReviewStatus,

    /// Commits being reviewed (by hash)
    pub commits: Vec<String>,

    /// Created timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Last updated timestamp
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
