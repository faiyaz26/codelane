use tauri::AppHandle;
use super::manager::ExtensionState;
use super::manifest::ExtensionInfo;

#[tauri::command]
pub async fn extension_list(state: tauri::State<'_, ExtensionState>, force: Option<bool>) -> Result<Vec<ExtensionInfo>, String> {
    let should_scan = {
        let last_scanned = state.last_scanned.lock().await;
        last_scanned.is_none() || force.unwrap_or(false)
    };

    if should_scan {
        state.discover_extensions().await.map_err(|e| e.to_string())?;
    }

    let extensions = state.extensions.lock().await;
    Ok(extensions.values().map(|e| ExtensionInfo {
        manifest: e.manifest.clone(),
        running: e.is_running,
    }).collect())
}

#[tauri::command]
pub async fn extension_start(
    app: AppHandle,
    state: tauri::State<'_, ExtensionState>,
    settings_state: tauri::State<'_, crate::settings::SettingsState>,
    id: String
) -> Result<(), String> {
    state.start_extension(app, &id).await.map_err(|e| e.to_string())?;
    
    // Persist enabled state
    let mut settings = settings_state.get_agent_settings()?;
    if !settings.enabled_extensions.contains(&id) {
        settings.enabled_extensions.push(id);
        settings_state.update_agent_settings(settings)?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn extension_stop(
    state: tauri::State<'_, ExtensionState>,
    settings_state: tauri::State<'_, crate::settings::SettingsState>,
    id: String
) -> Result<(), String> {
    state.stop_extension(&id).await.map_err(|e| e.to_string())?;
    
    // Persist disabled state
    let mut settings = settings_state.get_agent_settings()?;
    if let Some(pos) = settings.enabled_extensions.iter().position(|x| x == &id) {
        settings.enabled_extensions.remove(pos);
        settings_state.update_agent_settings(settings)?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn extension_uninstall(
    state: tauri::State<'_, ExtensionState>,
    settings_state: tauri::State<'_, crate::settings::SettingsState>,
    id: String
) -> Result<(), String> {
    state.uninstall_extension(&id).await.map_err(|e| e.to_string())?;
    
    // Persist removed state
    let mut settings = settings_state.get_agent_settings()?;
    if let Some(pos) = settings.enabled_extensions.iter().position(|x| x == &id) {
        settings.enabled_extensions.remove(pos);
        settings_state.update_agent_settings(settings)?;
    }
    
    Ok(())
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
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(registry_url).send().await.map_err(|e| format!("Failed to fetch registry: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Registry fetch failed with status: {}", response.status()));
    }

    let text = response.text().await.map_err(|e| format!("Failed to read registry response: {}", e))?;
    let json = serde_json::from_str(&text).map_err(|e| format!("Failed to parse registry JSON: {}. Response: {}", e, text))?;
    
    Ok(json)
}
