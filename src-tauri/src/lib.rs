//! Codelane Tauri Library
//!
//! This module contains all Tauri commands and plugin setup for the Codelane application.
//! Commands are organized by domain: lane, git, and filesystem operations.

pub mod extension;
pub mod lane;
pub mod paths;
pub mod settings;
pub mod store;
pub mod process;
pub mod terminal;
pub mod search;
pub mod hooks;
pub mod hook_monitor;
mod git;
mod fs;
mod file_sorter;
mod import_analyzer;
mod dependency_graph;
mod ai;
mod github;

use tauri::{Emitter, Manager};

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
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())  // JSON store
        .plugin(tauri_plugin_notification::init());

    // Add updater plugin on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        // Register custom URI scheme for extension assets
        .register_uri_scheme_protocol("codelane-assets", |_app, request| {
            let uri = request.uri().to_string();
            
            // Flexible prefix stripping (handles codelane-assets:// or codelane-assets:)
            let path_part = if let Some(rest) = uri.strip_prefix("codelane-assets://") {
                rest
            } else if let Some(rest) = uri.strip_prefix("codelane-assets:") {
                rest
            } else {
                &uri
            };

            tracing::debug!("[Protocol] Extension asset requested: {} (parsed as {})", uri, path_part);
            
            // Expected format: extensions/{id}/{path}
            if let Some(rest) = path_part.strip_prefix("extensions/") {
                let parts: Vec<&str> = rest.splitn(2, '/').collect();
                if parts.len() == 2 {
                    let extension_id = parts[0];
                    let relative_path = parts[1].split('?').next().unwrap_or(parts[1]); // Strip query params
                    
                    let extension_dir = paths::extensions_dir().join(extension_id);
                    let file_path = extension_dir.join(relative_path);
                    
                    // Security: ensure the file is within the extensions directory
                    let extension_dir_canonical = std::fs::canonicalize(&extension_dir).unwrap_or(extension_dir.clone());
                    let file_path_canonical = std::fs::canonicalize(&file_path).unwrap_or(file_path.clone());

                    if file_path_canonical.exists() && (file_path_canonical.starts_with(&extension_dir_canonical) || cfg!(debug_assertions)) {
                        if let Ok(content) = std::fs::read(&file_path_canonical) {
                            let mime_type = match file_path_canonical.extension().and_then(|s| s.to_str()) {
                                Some("js") => "application/javascript",
                                Some("css") => "text/css",
                                Some("html") => "text/html",
                                Some("png") => "image/png",
                                Some("jpg") | Some("jpeg") => "image/jpeg",
                                Some("svg") => "image/svg+xml",
                                Some("json") => "application/json",
                                _ => "application/octet-stream",
                            };
                            
                            return tauri::http::Response::builder()
                                .header("Content-Type", mime_type)
                                .header("Access-Control-Allow-Origin", "*")
                                .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                                .header("Access-Control-Allow-Headers", "*")
                                .body(content)
                                .unwrap();
                        }
                    } else {
                        tracing::warn!("[Protocol] File not found or access denied: {:?}", file_path_canonical);
                    }
                }
            }
            
            tauri::http::Response::builder()
                .status(404)
                .header("Access-Control-Allow-Origin", "*")
                .body(Vec::new())
                .unwrap()
        })
        // Manage extension state
        .manage(extension::ExtensionState::new())
        // Manage lane state
        .manage(lane::LaneState::new())
        // Manage settings state
        .manage(settings::SettingsState::new())
        // Manage terminal state
        .manage(terminal::TerminalState::new())
        // Manage search state
        .manage(search::SearchState::new())
        // Manage file watch state
        .manage(fs::FileWatchState::new())
        // Manage hook monitor state
        .manage(hook_monitor::HookMonitorState::new())
        // Register commands
        .invoke_handler(tauri::generate_handler![
            // Extension commands
            extension::extension_list,
            extension::extension_start,
            extension::extension_stop,
            extension::extension_uninstall,
            extension::extension_install,
            extension::extension_get_registry,

            // Store commands
            store::get_store_path,
            // Lane commands
            lane::lane_create,
            lane::lane_list,
            lane::lane_get,
            lane::lane_update,
            lane::lane_delete,
            lane::lane_batch_create,
            lane::lane_update_config,
            lane::lane_touch,
            lane::lane_update_type,
            // Settings commands
            settings::settings_get_agents,
            settings::settings_update_agents,
            settings::lane_get_agent_config,
            settings::lane_update_agent_config,
            settings::check_command_exists,
            // Process monitoring
            process::find_process_by_lane,
            process::get_app_resource_usage,
            // Git commands
            git::git_status,
            git::git_diff,
            git::git_show_file,
            git::git_changes_with_stats,
            git::git_commit_changes,
            git::git_commit_file_diff,
            git::git_sort_files,
            git::git_log,
            git::git_branch,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_discard,
            // Git worktree commands
            git::git_init,
            git::git_clone,
            git::git_get_remote_url,
            git::git_is_repo,
            git::git_branch_exists,
            git::git_create_branch,
            git::git_default_branch,
            git::git_worktree_add,
            git::git_worktree_list,
            git::git_worktree_remove,
            // Git remote + branch diff commands
            git::git_fetch_branch,
            git::git_fetch_pr_branch,
            git::git_diff_branch,
            git::git_branch_changes_with_stats,
            // GitHub CLI commands
            github::github_check_status,
            github::github_fetch_pr,
            github::github_submit_review,
            github::github_fetch_pr_review_comments,
            github::github_fetch_pr_conversation,
            github::github_submit_review_with_comments,
            // AI code review commands
            ai::ai_generate_review,
            ai::ai_test_tool,
            ai::ai_get_available_tools,
            // Filesystem commands
            fs::read_file,
            fs::write_file,
            fs::list_directory,
            fs::watch_path,
            fs::unwatch_path,
            fs::get_file_stats,
            // Terminal commands (using portable-pty)
            terminal::create_terminal,
            terminal::write_terminal,
            terminal::read_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            terminal::get_terminal_info,
            terminal::list_terminals,
            terminal::get_terminal_pid_by_lane,
            terminal::get_terminal_id_by_lane,
            // Search commands
            search::search_start,
            search::search_cancel,
            // Hook commands
            hooks::hooks_install,
            hooks::hooks_uninstall,
            hooks::hooks_check_status,
            hooks::hooks_test,
        ])
        // Window setup
        .setup(|app| {
            // Create application menu
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

            let menu = Menu::new(app)?;

            // Create "Codelane" menu (macOS) or "Help" menu (Windows/Linux)
            #[cfg(target_os = "macos")]
            let app_menu = {
                let submenu = Submenu::new(app, "Codelane", true)?;
                let about_item = MenuItem::with_id(app, "about", "About Codelane", true, None::<&str>)?;
                submenu.append(&about_item)?;
                submenu.append(&PredefinedMenuItem::separator(app)?)?;
                submenu.append(&PredefinedMenuItem::quit(app, Some("Quit Codelane"))?)?;
                submenu
            };

            #[cfg(not(target_os = "macos"))]
            let app_menu = {
                let submenu = Submenu::new(app, "Help", true)?;
                submenu
            };

            // Edit menu — provides native keyboard shortcuts (Cmd+A, Cmd+C, etc.)
            // Without this, macOS webviews don't wire standard text editing shortcuts.
            let edit_menu = {
                let submenu = Submenu::new(app, "Edit", true)?;
                submenu.append(&PredefinedMenuItem::undo(app, None)?)?;
                submenu.append(&PredefinedMenuItem::redo(app, None)?)?;
                submenu.append(&PredefinedMenuItem::separator(app)?)?;
                submenu.append(&PredefinedMenuItem::cut(app, None)?)?;
                submenu.append(&PredefinedMenuItem::copy(app, None)?)?;
                submenu.append(&PredefinedMenuItem::paste(app, None)?)?;
                submenu.append(&PredefinedMenuItem::select_all(app, None)?)?;
                submenu
            };

            // Create Help menu (always shown)
            let help_menu = {
                let submenu = Submenu::new(app, "Help", true)?;
                let first_time_setup_item = MenuItem::with_id(app, "first-time-setup", "First-Time Setup", true, None::<&str>)?;
                submenu.append(&first_time_setup_item)?;

                submenu.append(&PredefinedMenuItem::separator(app)?)?;
                let check_updates_item = MenuItem::with_id(app, "check-for-updates", "Check for Updates...", true, None::<&str>)?;
                submenu.append(&check_updates_item)?;

                // Add About to Help menu on non-macOS platforms
                #[cfg(not(target_os = "macos"))]
                {
                    submenu.append(&PredefinedMenuItem::separator(app)?)?;
                    let about_item = MenuItem::with_id(app, "about", "About Codelane", true, None::<&str>)?;
                    submenu.append(&about_item)?;
                }

                submenu
            };

            #[cfg(target_os = "macos")]
            {
                menu.append(&app_menu)?;
                menu.append(&edit_menu)?;
                menu.append(&help_menu)?;
            }

            #[cfg(not(target_os = "macos"))]
            {
                menu.append(&edit_menu)?;
                menu.append(&help_menu)?;
            }

            app.set_menu(menu)?;

            // Handle menu events
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    match event.id().as_ref() {
                        "about" => {
                            let _ = window.emit("menu:about", ());
                        }
                        "first-time-setup" => {
                            let _ = window.emit("menu:first-time-setup", ());
                        }
                        "check-for-updates" => {
                            let _ = window.emit("menu:check-for-updates", ());
                        }
                        _ => {}
                    }
                }
            });

            #[cfg(feature = "devtools")]
            {
                let window = app.get_webview_window("main").expect("main window not found");
                window.open_devtools();
            }

            // Cleanup old hook events on startup (remove events older than 1 hour)
            if let Err(e) = hook_monitor::HookMonitorState::cleanup_old_events(1) {
                tracing::warn!("Failed to cleanup old hook events on startup: {}", e);
            }

            // Start periodic cleanup timer (every 30 minutes)
            std::thread::spawn(|| {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(30 * 60));
                    if let Err(e) = hook_monitor::HookMonitorState::cleanup_old_events(1) {
                        tracing::warn!("Periodic hook event cleanup failed: {}", e);
                    }
                }
            });

            // Auto-start enabled extensions
            let extension_state = app.state::<extension::ExtensionState>();
            let settings_state = app.state::<settings::SettingsState>();
            let app_handle = app.handle().clone();
            
            if let Ok(settings) = settings_state.get_agent_settings() {
                let enabled_ids = settings.enabled_extensions;
                if !enabled_ids.is_empty() {
                    let ext_state = extension_state.inner().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = ext_state.auto_start_extensions(app_handle, enabled_ids).await {
                            tracing::error!("Failed to auto-start extensions: {}", e);
                        }
                    });
                }
            }

            tracing::info!("Codelane window initialized with menu");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
