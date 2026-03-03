use tauri::AppHandle;
use super::manager::ExtensionState;
use super::manifest::ExtensionManifest;

#[tauri::command]
pub fn extension_list(state: tauri::State<'_, ExtensionState>, force: Option<bool>) -> Result<Vec<ExtensionManifest>, String> {
    let should_scan = {
        let last_scanned = state.last_scanned.lock().unwrap();
        last_scanned.is_none() || force.unwrap_or(false)
    };

    if should_scan {
        state.discover_extensions().map_err(|e| e.to_string())?;
    }

    let extensions = state.extensions.lock().unwrap();
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
