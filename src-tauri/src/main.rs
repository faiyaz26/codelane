//! Codelane Tauri Application Entry Point
//!
//! This is the main entry point for the Tauri shell that hosts the Dioxus frontend.
//! The Dioxus app renders in the WebView, while Tauri provides native capabilities.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn main() {
    // Initialize logging with cleaner output
    tracing_subscriber::registry()
        .with(
            fmt::layer()
                .with_target(false)
                .with_thread_ids(false)
                .with_thread_names(false)
                .with_line_number(false)
                .with_file(false)
                .compact()
        )
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| {
                    if cfg!(debug_assertions) {
                        EnvFilter::new("codelane=debug,codelane_tauri=debug,codelane_git=debug,info")
                    } else {
                        EnvFilter::new("codelane=info,codelane_tauri=info,codelane_git=info,warn")
                    }
                })
        )
        .init();

    tracing::info!("Starting Codelane...");

    // Set a panic hook to capture and log crashes
    std::panic::set_hook(Box::new(|info| {
        let location = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_else(|| "unknown".to_string());
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "no message".to_string()
        };
        
        tracing::error!("CRITICAL CRASH (Panic) at {}: {}", location, payload);
        eprintln!("CRITICAL CRASH (Panic) at {}: {}", location, payload);
    }));

    codelane_tauri_lib::run();
}
