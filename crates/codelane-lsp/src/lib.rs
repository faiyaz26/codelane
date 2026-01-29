//! LSP client for Codelane
//!
//! Manages language server processes and communication.

pub mod client;
pub mod diagnostics;
pub mod manager;

mod error;

pub use error::{Error, Result};

/// Re-export lsp-types for convenience
pub use lsp_types;
