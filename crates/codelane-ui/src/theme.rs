//! Theme definitions

use serde::{Deserialize, Serialize};

/// Application theme
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    pub colors: ThemeColors,
}

/// Theme color palette
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    /// Background colors
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_tertiary: String,

    /// Foreground (text) colors
    pub fg_primary: String,
    pub fg_secondary: String,
    pub fg_muted: String,

    /// Accent colors
    pub accent: String,
    pub accent_hover: String,

    /// Status colors
    pub success: String,
    pub warning: String,
    pub error: String,
    pub info: String,

    /// Border colors
    pub border: String,
    pub border_focus: String,
}

impl Default for Theme {
    fn default() -> Self {
        Self::dark()
    }
}

impl Theme {
    /// Dark theme
    pub fn dark() -> Self {
        Self {
            name: "dark".to_string(),
            colors: ThemeColors {
                bg_primary: "#1e1e1e".to_string(),
                bg_secondary: "#252526".to_string(),
                bg_tertiary: "#2d2d30".to_string(),
                fg_primary: "#d4d4d4".to_string(),
                fg_secondary: "#cccccc".to_string(),
                fg_muted: "#6e7681".to_string(),
                accent: "#0078d4".to_string(),
                accent_hover: "#1c8ae8".to_string(),
                success: "#3fb950".to_string(),
                warning: "#d29922".to_string(),
                error: "#f85149".to_string(),
                info: "#58a6ff".to_string(),
                border: "#3d3d3d".to_string(),
                border_focus: "#0078d4".to_string(),
            },
        }
    }

    /// Light theme
    pub fn light() -> Self {
        Self {
            name: "light".to_string(),
            colors: ThemeColors {
                bg_primary: "#ffffff".to_string(),
                bg_secondary: "#f5f5f5".to_string(),
                bg_tertiary: "#ebebeb".to_string(),
                fg_primary: "#1f1f1f".to_string(),
                fg_secondary: "#424242".to_string(),
                fg_muted: "#6e6e6e".to_string(),
                accent: "#0078d4".to_string(),
                accent_hover: "#106ebe".to_string(),
                success: "#1a7f37".to_string(),
                warning: "#9a6700".to_string(),
                error: "#cf222e".to_string(),
                info: "#0969da".to_string(),
                border: "#d0d7de".to_string(),
                border_focus: "#0078d4".to_string(),
            },
        }
    }
}
