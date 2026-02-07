//! Database initialization and utilities

use std::path::PathBuf;

use crate::paths;

/// Get the database file path
pub fn get_db_path() -> PathBuf {
    paths::db_path()
}

/// Get the database URL for tauri-plugin-sql
pub fn get_db_url() -> String {
    let db_path = get_db_path();
    format!("sqlite:{}", db_path.display())
}

/// Tauri command to get the database path for frontend
#[tauri::command]
pub fn db_get_path() -> String {
    get_db_url()
}

/// Initialize database schema SQL (for reference)
pub const INIT_SCHEMA: &str = include_str!("../migrations/001_initial_schema.sql");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_db_path_returns_valid_path() {
        let path = get_db_path();
        assert!(path.to_string_lossy().contains(".codelane"));
        assert!(path.to_string_lossy().ends_with("codelane.db"));
    }

    #[test]
    fn test_get_db_path_creates_directory() {
        let path = get_db_path();
        let parent = path.parent().expect("Should have parent directory");
        assert!(parent.exists(), "Directory should be created");
    }

    #[test]
    fn test_get_db_url_format() {
        let url = get_db_url();
        assert!(url.starts_with("sqlite:"));
        assert!(url.contains("codelane.db"));
    }

    #[test]
    fn test_db_get_path_command() {
        let url = db_get_path();
        assert!(url.starts_with("sqlite:"));
        assert!(url.contains(".codelane"));
    }

    #[test]
    fn test_init_schema_not_empty() {
        assert!(!INIT_SCHEMA.is_empty());
    }

    #[test]
    fn test_init_schema_contains_sql() {
        assert!(INIT_SCHEMA.contains("CREATE") || INIT_SCHEMA.contains("create"));
    }

    #[test]
    fn test_db_path_is_absolute() {
        let path = get_db_path();
        assert!(path.is_absolute(), "Database path should be absolute");
    }

    #[test]
    fn test_db_path_in_home_directory() {
        let path = get_db_path();
        let home = std::env::var("HOME").expect("HOME should be set");
        assert!(
            path.starts_with(&home),
            "Database should be in home directory"
        );
    }
}
