pub mod manifest;
pub mod manager;
pub mod rpc;
pub mod commands;

pub use manifest::{Extension, ExtensionManifest};
pub use manager::ExtensionState;

// Re-export commands so they are visible to tauri::generate_handler!
pub use commands::*;
