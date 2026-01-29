//! Core types and traits for Codelane
//!
//! This crate provides the foundational types used across all Codelane components.

pub mod config;
pub mod lane;
pub mod project;

mod error;
mod id;

pub use error::{Error, Result};
pub use id::*;

/// Re-export commonly used types
pub mod prelude {
    pub use crate::config::*;
    pub use crate::error::{Error, Result};
    pub use crate::id::*;
    pub use crate::lane::*;
    pub use crate::project::*;
}
