//! Monaco editor integration for Codelane
//!
//! This crate provides types and utilities for Monaco editor JS interop.
//! It includes:
//!
//! - `monaco` - Configuration types for Monaco editor instances
//! - `commands` - Editor commands that can be executed
//! - `bridge` - JavaScript code generation for the Monaco bridge layer
//!
//! # Example
//!
//! ```rust,ignore
//! use codelane_editor::{Language, monaco::MonacoConfig, bridge::MonacoJsBuilder};
//!
//! // Create a config
//! let config = MonacoConfig::default()
//!     .with_theme("codelane-dark")
//!     .with_font_size(14);
//!
//! // Generate JS to create editor
//! let js_builder = MonacoJsBuilder::new("my_editor");
//! let create_js = js_builder.create_editor("container", &config, "hello", Language::Rust);
//! ```

pub mod bridge;
pub mod commands;
pub mod monaco;

/// Monaco editor event types
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum MonacoEvent {
    #[serde(rename = "change")]
    Change {
        #[serde(rename = "editorId")]
        editor_id: String,
        content: String,
    },
    #[serde(rename = "save")]
    Save {
        #[serde(rename = "editorId")]
        editor_id: String,
        content: String,
    },
    #[serde(rename = "cursor")]
    CursorChange {
        #[serde(rename = "editorId")]
        editor_id: String,
        line: u32,
        column: u32,
    },
}

/// Language ID for Monaco
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Rust,
    TypeScript,
    JavaScript,
    Python,
    Go,
    Json,
    Toml,
    Yaml,
    Markdown,
    Html,
    Css,
    PlainText,
}

impl Language {
    /// Get Monaco language ID string
    pub fn monaco_id(&self) -> &'static str {
        match self {
            Language::Rust => "rust",
            Language::TypeScript => "typescript",
            Language::JavaScript => "javascript",
            Language::Python => "python",
            Language::Go => "go",
            Language::Json => "json",
            Language::Toml => "toml",
            Language::Yaml => "yaml",
            Language::Markdown => "markdown",
            Language::Html => "html",
            Language::Css => "css",
            Language::PlainText => "plaintext",
        }
    }

    /// Detect language from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => Language::Rust,
            "ts" | "tsx" => Language::TypeScript,
            "js" | "jsx" | "mjs" | "cjs" => Language::JavaScript,
            "py" | "pyi" => Language::Python,
            "go" => Language::Go,
            "json" => Language::Json,
            "toml" => Language::Toml,
            "yaml" | "yml" => Language::Yaml,
            "md" | "markdown" => Language::Markdown,
            "html" | "htm" => Language::Html,
            "css" | "scss" | "less" => Language::Css,
            _ => Language::PlainText,
        }
    }
}
