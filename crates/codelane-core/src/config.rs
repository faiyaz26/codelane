//! Application configuration

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Global application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    /// General settings
    pub general: GeneralConfig,

    /// Terminal settings
    pub terminal: TerminalConfig,

    /// Editor settings
    pub editor: EditorConfig,

    /// Git settings
    pub git: GitConfig,

    /// Theme settings
    pub theme: ThemeConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            terminal: TerminalConfig::default(),
            editor: EditorConfig::default(),
            git: GitConfig::default(),
            theme: ThemeConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GeneralConfig {
    /// Font family for the application
    pub font_family: String,

    /// Font size in pixels
    pub font_size: u32,

    /// Whether to restore previous session on startup
    pub restore_session: bool,
}

impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            font_family: "JetBrains Mono".to_string(),
            font_size: 14,
            restore_session: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TerminalConfig {
    /// Default shell (None = system default)
    pub shell: Option<String>,

    /// Scrollback lines
    pub scrollback_lines: u32,

    /// Cursor style: "block", "underline", or "beam"
    pub cursor_style: String,

    /// Cursor blink
    pub cursor_blink: bool,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self {
            shell: None,
            scrollback_lines: 10000,
            cursor_style: "block".to_string(),
            cursor_blink: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct EditorConfig {
    /// Tab size in spaces
    pub tab_size: u32,

    /// Insert spaces instead of tabs
    pub insert_spaces: bool,

    /// Word wrap
    pub word_wrap: bool,

    /// Show minimap
    pub minimap: bool,

    /// Show line numbers
    pub line_numbers: bool,

    /// Enable bracket pair colorization
    pub bracket_colorization: bool,
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            tab_size: 4,
            insert_spaces: true,
            word_wrap: false,
            minimap: true,
            line_numbers: true,
            bracket_colorization: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GitConfig {
    /// Auto-fetch interval in minutes (0 = disabled)
    pub auto_fetch_interval: u32,

    /// Show untracked files
    pub show_untracked: bool,

    /// Enable AI explanations for changes
    pub explain_changes: bool,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            auto_fetch_interval: 5,
            show_untracked: true,
            explain_changes: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ThemeConfig {
    /// Theme name or "system" for auto
    pub name: String,

    /// Custom CSS overrides
    pub custom_css: Option<String>,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            name: "dark".to_string(),
            custom_css: None,
        }
    }
}

impl AppConfig {
    /// Load configuration from the default location
    pub fn load() -> crate::Result<Self> {
        let config_path = Self::config_path()?;

        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            let config: AppConfig = toml::from_str(&content)?;
            Ok(config)
        } else {
            Ok(Self::default())
        }
    }

    /// Save configuration to the default location
    pub fn save(&self) -> crate::Result<()> {
        let config_path = Self::config_path()?;

        // Ensure parent directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = toml::to_string_pretty(self)
            .map_err(|e| crate::Error::Config(e.to_string()))?;
        std::fs::write(&config_path, content)?;

        Ok(())
    }

    /// Get the configuration file path
    pub fn config_path() -> crate::Result<PathBuf> {
        let dirs = directories::ProjectDirs::from("dev", "codelane", "Codelane")
            .ok_or_else(|| crate::Error::Config("Could not determine config directory".into()))?;

        Ok(dirs.config_dir().join("config.toml"))
    }

    /// Get the data directory path
    pub fn data_dir() -> crate::Result<PathBuf> {
        let dirs = directories::ProjectDirs::from("dev", "codelane", "Codelane")
            .ok_or_else(|| crate::Error::Config("Could not determine data directory".into()))?;

        Ok(dirs.data_dir().to_path_buf())
    }
}
