//! Codelane Tauri Library
//!
//! This module contains all Tauri commands and plugin setup for the Codelane application.
//! Commands are organized by domain: lane, git, and filesystem operations.

pub mod lane;
pub mod settings;
pub mod db;
pub mod process;
mod git;
mod fs;

use tauri::Manager;

/// Run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_pty::init())  // PTY plugin for terminals
        .plugin(tauri_plugin_sql::Builder::default().build());  // SQLite database

    // Add updater plugin on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        // Manage lane state
        .manage(lane::LaneState::new())
        // Manage settings state
        .manage(settings::SettingsState::new())
        // Register commands
        .invoke_handler(tauri::generate_handler![
            // Database commands
            db::db_get_path,
            // Lane commands
            lane::lane_create,
            lane::lane_list,
            lane::lane_get,
            lane::lane_update,
            lane::lane_delete,
            // Settings commands
            settings::settings_get_agents,
            settings::settings_update_agents,
            settings::lane_get_agent_config,
            settings::lane_update_agent_config,
            settings::check_command_exists,
            // Process monitoring
            process::get_process_stats,
            process::find_process_by_lane,
            // Git commands
            git::git_status,
            git::git_diff,
            git::git_log,
            git::git_branch,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_discard,
            // Filesystem commands
            fs::read_file,
            fs::write_file,
            fs::list_directory,
            fs::watch_path,
            fs::unwatch_path,
        ])
        // Window setup
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window not found");

            // Enable devtools in debug mode
            #[cfg(debug_assertions)]
            window.open_devtools();

            tracing::info!("Codelane window initialized");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
