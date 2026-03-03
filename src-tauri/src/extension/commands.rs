use tauri::AppHandle;
use super::manager::ExtensionState;
use super::manifest::ExtensionManifest;

#[tauri::command]
pub async fn extension_list(state: tauri::State<'_, ExtensionState>, force: Option<bool>) -> Result<Vec<ExtensionManifest>, String> {
    let should_scan = {
        let last_scanned = state.last_scanned.lock().await;
        last_scanned.is_none() || force.unwrap_or(false)
    };

    if should_scan {
        state.discover_extensions().await.map_err(|e| e.to_string())?;
    }

    let extensions = state.extensions.lock().await;
    Ok(extensions.values().map(|e| e.manifest.clone()).collect())
}

#[tauri::command]
pub async fn extension_start(
    app: AppHandle,
    state: tauri::State<'_, ExtensionState>,
    id: String
) -> Result<(), String> {
    state.start_extension(app, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn extension_stop(
    state: tauri::State<'_, ExtensionState>,
    id: String
) -> Result<(), String> {
    state.stop_extension(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extension_install(
    state: tauri::State<'_, ExtensionState>,
    download_url: String,
    sha256: String
) -> Result<(), String> {
    state.install_extension(&download_url, &sha256).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extension_get_registry() -> Result<serde_json::Value, String> {
    let registry_url = "https://raw.githubusercontent.com/google/codelane/main/extensions/registry.json";
    let response = reqwest::get(registry_url).await.map_err(|e| e.to_string())?;
    let json = response.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    Ok(json)
}
