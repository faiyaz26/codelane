//! Database initialization and utilities

use std::path::PathBuf;
use tauri::State;

/// Get the database file path
pub fn get_db_path() -> PathBuf {
    let home = std::env::var("HOME").expect("HOME environment variable not set");
    let codelane_dir = PathBuf::from(home).join(".codelane");

    // Ensure directory exists
    std::fs::create_dir_all(&codelane_dir).expect("Failed to create .codelane directory");

    codelane_dir.join("codelane.db")
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

/// Initialize database schema SQL
pub const INIT_SCHEMA: &str = include_str!("../migrations/001_initial_schema.sql");
