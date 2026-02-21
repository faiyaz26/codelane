//! Store path provider for tauri-plugin-store

/// Tauri command to get the store file path for frontend
#[tauri::command]
pub fn get_store_path() -> Result<String, String> {
    let path = codelane_core::paths::store_path().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_store_path_returns_json_path() {
        let path = get_store_path().unwrap();
        assert!(path.contains(".codelane"));
        assert!(path.ends_with("codelane-data.json"));
    }

    #[test]
    fn test_get_store_path_contains_env() {
        let path = get_store_path().unwrap();
        assert!(path.contains("dev") || path.contains("prod"));
    }
}
