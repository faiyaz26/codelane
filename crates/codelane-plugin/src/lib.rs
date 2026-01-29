//! WASM plugin host for Codelane
//!
//! Provides sandboxed plugin execution using Wasmtime.

pub mod api;
pub mod host;
pub mod manifest;

mod error;

pub use error::{Error, Result};
