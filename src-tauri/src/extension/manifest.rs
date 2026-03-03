use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::process::Child;

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

pub struct Extension {
    pub manifest: ExtensionManifest,
    pub path: PathBuf,
    pub child_process: Option<Arc<Mutex<Child>>>,
}
