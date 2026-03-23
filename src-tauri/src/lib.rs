//! Codelane Tauri Library
//!
//! This module contains all Tauri commands and plugin setup for the Codelane application.
//! Commands are organized by domain: lane, git, and filesystem operations.

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

            tracing::info!("Codelane window initialized with menu");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
