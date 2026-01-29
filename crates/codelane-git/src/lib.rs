//! Git integration for Codelane using gitoxide
//!
//! This crate provides git operations with AI-powered change explanations.


pub mod diff;
pub mod repository;
pub mod status;

mod error;

pub use error::{Error, Result};

/// Re-export commonly used types
pub mod prelude {
    pub use crate::diff::*;
    pub use crate::error::{Error, Result};
    pub use crate::repository::*;
    pub use crate::status::*;
}
