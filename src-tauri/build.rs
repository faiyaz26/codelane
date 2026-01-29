//! Build script for Tauri application
//!
//! This script runs at compile time and handles:
//! - Tauri build integration
//! - Asset preparation
//! - Platform-specific setup

fn main() {
    // Tauri build integration
    tauri_build::build();

    // Rerun if Tauri config changes
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=capabilities/");
    println!("cargo:rerun-if-changed=icons/");

    // Rerun if frontend assets change
    println!("cargo:rerun-if-changed=../assets/");
    println!("cargo:rerun-if-changed=../crates/codelane/dist/");

    // Platform-specific setup
    #[cfg(target_os = "macos")]
    {
        // macOS-specific build configuration
        println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=10.15");
    }

    #[cfg(target_os = "windows")]
    {
        // Windows-specific build configuration
        // Enable high DPI support
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    }

    #[cfg(target_os = "linux")]
    {
        // Linux-specific build configuration
        // Nothing special needed currently
    }
}
