//! Monaco editor bridge types
//!
//! This module provides types for configuring Monaco Editor instances
//! and communicating with the JavaScript bridge layer.

use serde::{Deserialize, Serialize};

/// Monaco editor configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonacoConfig {
    /// Editor theme (e.g., "vs-dark", "codelane-dark")
    pub theme: String,
    /// Font size in pixels
    pub font_size: u32,
    /// Font family string
    pub font_family: String,
    /// Tab size in spaces
    pub tab_size: u32,
    /// Whether to insert spaces instead of tabs
    pub insert_spaces: bool,
    /// Word wrap mode: "off", "on", "wordWrapColumn", "bounded"
    pub word_wrap: String,
    /// Whether minimap is enabled
    pub minimap_enabled: bool,
    /// Line numbers mode: "on", "off", "relative", "interval"
    pub line_numbers: String,
    /// Whether the editor is read-only
    pub read_only: bool,
}

impl Default for MonacoConfig {
    fn default() -> Self {
        Self {
            theme: "codelane-dark".to_string(),
            font_size: 14,
            font_family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace".to_string(),
            tab_size: 4,
            insert_spaces: true,
            word_wrap: "off".to_string(),
            minimap_enabled: true,
            line_numbers: "on".to_string(),
            read_only: false,
        }
    }
}

impl MonacoConfig {
    /// Create a minimal configuration for performance
    pub fn minimal() -> Self {
        Self {
            minimap_enabled: false,
            ..Default::default()
        }
    }

    /// Create configuration for diff viewing (read-only)
    pub fn diff_viewer() -> Self {
        Self {
            read_only: true,
            minimap_enabled: false,
            ..Default::default()
        }
    }

    /// Builder method to set the theme
    pub fn with_theme(mut self, theme: impl Into<String>) -> Self {
        self.theme = theme.into();
        self
    }

    /// Builder method to set font size
    pub fn with_font_size(mut self, size: u32) -> Self {
        self.font_size = size;
        self
    }

    /// Builder method to set font family
    pub fn with_font_family(mut self, family: impl Into<String>) -> Self {
        self.font_family = family.into();
        self
    }

    /// Builder method to set tab size
    pub fn with_tab_size(mut self, size: u32) -> Self {
        self.tab_size = size;
        self
    }

    /// Builder method to enable/disable minimap
    pub fn with_minimap(mut self, enabled: bool) -> Self {
        self.minimap_enabled = enabled;
        self
    }

    /// Builder method to set read-only mode
    pub fn with_read_only(mut self, read_only: bool) -> Self {
        self.read_only = read_only;
        self
    }

    /// Builder method to set word wrap
    pub fn with_word_wrap(mut self, mode: impl Into<String>) -> Self {
        self.word_wrap = mode.into();
        self
    }

    /// Builder method to set line numbers mode
    pub fn with_line_numbers(mut self, mode: impl Into<String>) -> Self {
        self.line_numbers = mode.into();
        self
    }
}

/// Monaco diff editor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffEditorConfig {
    pub render_side_by_side: bool,
    pub ignore_trim_whitespace: bool,
    pub original_editable: bool,
}

impl Default for DiffEditorConfig {
    fn default() -> Self {
        Self {
            render_side_by_side: true,
            ignore_trim_whitespace: true,
            original_editable: false,
        }
    }
}

/// Position in the editor
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub column: u32,
}

/// Range in the editor
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}
