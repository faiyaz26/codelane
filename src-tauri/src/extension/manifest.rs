use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::process::{Child, ChildStdin};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub main_backend: Option<String>,
    pub main_frontend: Option<String>,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExtensionInfo {
    #[serde(flatten)]
    pub manifest: ExtensionManifest,
    pub running: bool,
}

pub struct Extension {
    pub manifest: ExtensionManifest,
    pub path: PathBuf,
    pub child_process: Option<Arc<Mutex<Child>>>,
    pub stdin: Option<Arc<Mutex<ChildStdin>>>,
    pub is_running: bool,
}
