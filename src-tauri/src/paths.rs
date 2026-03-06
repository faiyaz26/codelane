//! Thin wrappers around `codelane_core::paths`.
//!
//! These panic on failure (home dir missing, fs errors) which is acceptable
//! during app startup. Tauri commands that need fallible versions can use
//! `codelane_core::paths` directly.

use std::path::PathBuf;

pub use codelane_core::paths::env_name;

pub fn data_dir() -> PathBuf {
    codelane_core::paths::data_dir().expect("Failed to resolve codelane data directory")
}

pub fn lanes_dir() -> PathBuf {
    codelane_core::paths::lanes_dir().expect("Failed to resolve lanes directory")
}

pub fn worktree_path(project_name: &str, branch: &str) -> PathBuf {
    codelane_core::paths::worktree_path(project_name, branch)
        .expect("Failed to resolve worktree path")
}

pub fn extensions_dir() -> PathBuf {
    let dir = data_dir().join("extensions");
    std::fs::create_dir_all(&dir).expect("Failed to create extensions directory");
    dir
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_name_is_dev_in_debug() {
        assert_eq!(env_name(), "dev");
    }

    #[test]
    fn test_data_dir_contains_env() {
        let dir = data_dir();
        let path_str = dir.to_string_lossy();
        assert!(path_str.contains(".codelane"));
        assert!(path_str.contains(env_name()));
    }

    #[test]
    fn test_data_dir_exists() {
        assert!(data_dir().exists());
    }

    #[test]
    fn test_lanes_dir_exists() {
        assert!(lanes_dir().exists());
    }

    #[test]
    fn test_extensions_dir_exists() {
        assert!(extensions_dir().exists());
    }

    #[test]
    fn test_worktree_path_sanitizes_branch() {
        let path = worktree_path("my-project", "feature/login");
        assert!(path.to_string_lossy().contains("feature-login"));
    }
}
