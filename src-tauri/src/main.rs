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
                .unwrap_or_else(|_| EnvFilter::new("codelane=info,codelane_tauri=info,warn"))
        )
        .init();

    tracing::info!("Starting Codelane...");

    codelane_tauri_lib::run();
}
