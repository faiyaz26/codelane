//! Plugin manifest parsing

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Plugin manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Plugin metadata
    pub plugin: PluginMeta,

    /// Capabilities this plugin provides
    #[serde(default)]
    pub capabilities: PluginCapabilities,

    /// Permissions this plugin requires
    #[serde(default)]
    pub permissions: PluginPermissions,
}

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMeta {
    /// Plugin name
    pub name: String,

    /// Plugin version
    pub version: String,

    /// Description
    pub description: Option<String>,

    /// Entry point WASM file
    pub entry: String,
}

/// Plugin capabilities
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginCapabilities {
    /// Git provider configuration
    pub git_provider: Option<GitProviderCapability>,

    /// Commands this plugin provides
    #[serde(default)]
    pub commands: Vec<String>,

    /// Themes this plugin provides
    #[serde(default)]
    pub themes: Vec<String>,

    /// Languages this plugin supports
    #[serde(default)]
    pub languages: Vec<String>,
}

/// Git provider capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitProviderCapability {
    /// Domain this provider handles (e.g., "github.com")
    pub domain: String,
}

/// Plugin permissions
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginPermissions {
    /// Network hosts this plugin can access
    #[serde(default)]
    pub network: Vec<String>,

    /// Whether the plugin can read workspace files
    #[serde(default)]
    pub read_workspace: bool,

    /// Whether the plugin can write workspace files
    #[serde(default)]
    pub write_workspace: bool,
}

impl PluginManifest {
    /// Load manifest from a plugin.toml file
    pub fn load(path: &PathBuf) -> crate::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let manifest: Self = toml::from_str(&content)
            .map_err(|e| crate::Error::LoadFailed(e.to_string()))?;
        Ok(manifest)
    }
}
