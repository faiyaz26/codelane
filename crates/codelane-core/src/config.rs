//! Application configuration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

    /// AI code review settings
    pub ai: AIConfig,

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
            ai: AIConfig::default(),
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

    /// File sort order for code review
    pub file_sort_order: FileSortOrder,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            auto_fetch_interval: 5,
            show_untracked: true,
            explain_changes: true,
            file_sort_order: FileSortOrder::Smart,
        }
    }
}

/// File sorting strategy for code review
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FileSortOrder {
    /// Alphabetical by path (default Git behavior)
    Alphabetical,
    /// Smart heuristic-based sorting (config → types → impl → tests → generated → docs)
    Smart,
    /// Smart + dependency-aware sorting using tree-sitter import analysis
    SmartDependencies,
    /// Sort by change size (largest first)
    ChangeSize,
    /// No sorting (git order)
    None,
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

/// CLI agent type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentType {
    /// Claude Code CLI
    Claude,
    /// Cursor CLI
    Cursor,
    /// Aider CLI
    Aider,
    /// Traditional shell (backward compatibility)
    Shell,
}

/// AI code review configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AIConfig {
    /// Whether AI code review is enabled
    pub enabled: bool,

    /// Which AI tool to use
    pub tool: AITool,

    /// Custom command for the AI tool (if not using default)
    pub custom_command: Option<String>,

    /// Additional arguments to pass to the AI tool
    pub additional_args: Vec<String>,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            tool: AITool::Claude,
            custom_command: None,
            additional_args: Vec::new(),
        }
    }
}

/// AI tool for code review
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AITool {
    /// Claude Code CLI (claude)
    Claude,
    /// Aider CLI (aider)
    Aider,
    /// OpenCode CLI (opencode)
    OpenCode,
    /// Gemini CLI (gemini)
    Gemini,
    /// Custom command
    Custom,
}

/// CLI agent configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    /// Type of agent
    pub agent_type: AgentType,
    /// Command to execute
    pub command: String,
    /// CLI arguments
    pub args: Vec<String>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Use lane's working directory
    #[serde(default = "default_true")]
    pub use_lane_cwd: bool,
}

fn default_true() -> bool {
    true
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self::shell_default()
    }
}

impl AgentConfig {
    /// Default shell configuration
    pub fn shell_default() -> Self {
        Self {
            agent_type: AgentType::Shell,
            command: if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
            },
            args: if cfg!(windows) {
                vec!["-NoLogo".to_string()]
            } else {
                vec!["-l".to_string(), "-i".to_string()]
            },
            env: HashMap::new(),
            use_lane_cwd: true,
        }
    }

    /// Claude Code preset
    pub fn claude_preset() -> Self {
        Self {
            agent_type: AgentType::Claude,
            command: "claude".to_string(),
            args: vec![],
            env: HashMap::new(),
            use_lane_cwd: true,
        }
    }

    /// Cursor preset
    pub fn cursor_preset() -> Self {
        Self {
            agent_type: AgentType::Cursor,
            command: "cursor".to_string(),
            args: vec![],
            env: HashMap::new(),
            use_lane_cwd: true,
        }
    }

    /// Aider preset
    pub fn aider_preset() -> Self {
        Self {
            agent_type: AgentType::Aider,
            command: "aider".to_string(),
            args: vec![],
            env: HashMap::new(),
            use_lane_cwd: true,
        }
    }
}

/// Global agent settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSettings {
    /// Default agent to use
    pub default_agent: AgentConfig,
    /// Predefined agent configurations
    #[serde(default)]
    pub presets: HashMap<String, AgentConfig>,
}

impl Default for AgentSettings {
    fn default() -> Self {
        let mut presets = HashMap::new();
        presets.insert("shell".to_string(), AgentConfig::shell_default());
        presets.insert("claude".to_string(), AgentConfig::claude_preset());
        presets.insert("cursor".to_string(), AgentConfig::cursor_preset());
        presets.insert("aider".to_string(), AgentConfig::aider_preset());

        Self {
            default_agent: AgentConfig::shell_default(),
            presets,
        }
    }
}

impl AgentSettings {
    /// Load agent settings from the default location
    pub fn load() -> crate::Result<Self> {
        let settings_path = Self::settings_path()?;

        if settings_path.exists() {
            let content = std::fs::read_to_string(&settings_path)?;
            let settings: AgentSettings = serde_json::from_str(&content)
                .map_err(|e| crate::Error::Config(format!("Failed to parse agent settings: {}", e)))?;
            Ok(settings)
        } else {
            Ok(Self::default())
        }
    }

    /// Save agent settings to the default location
    pub fn save(&self) -> crate::Result<()> {
        let settings_path = Self::settings_path()?;

        // Ensure parent directory exists
        if let Some(parent) = settings_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)
            .map_err(|e| crate::Error::Config(format!("Failed to serialize agent settings: {}", e)))?;
        std::fs::write(&settings_path, content)?;

        Ok(())
    }

    /// Get the settings file path (~/.codelane/<env>/settings.json)
    pub fn settings_path() -> crate::Result<PathBuf> {
        crate::paths::settings_path()
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
