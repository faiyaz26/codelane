//! Diagnostic handling

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Diagnostic severity level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

/// A diagnostic message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    /// File path
    pub path: PathBuf,

    /// Start line (1-indexed)
    pub start_line: u32,

    /// Start column (1-indexed)
    pub start_column: u32,

    /// End line (1-indexed)
    pub end_line: u32,

    /// End column (1-indexed)
    pub end_column: u32,

    /// Severity
    pub severity: DiagnosticSeverity,

    /// Message
    pub message: String,

    /// Source (e.g., "rust-analyzer")
    pub source: Option<String>,

    /// Error code
    pub code: Option<String>,
}
