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

pub fn db_path() -> PathBuf {
    codelane_core::paths::db_path().expect("Failed to resolve database path")
}

pub fn lanes_dir() -> PathBuf {
    codelane_core::paths::lanes_dir().expect("Failed to resolve lanes directory")
}

pub fn worktree_path(project_name: &str, branch: &str) -> PathBuf {
    codelane_core::paths::worktree_path(project_name, branch)
        .expect("Failed to resolve worktree path")
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
        assert!(dir.to_string_lossy().contains(".codelane/dev"));
    }

    #[test]
    fn test_data_dir_exists() {
        assert!(data_dir().exists());
    }

    #[test]
    fn test_db_path() {
        let path = db_path();
        assert!(path.to_string_lossy().ends_with("codelane.db"));
        assert!(path.to_string_lossy().contains(".codelane/dev"));
    }

    #[test]
    fn test_lanes_dir_exists() {
        assert!(lanes_dir().exists());
    }

    #[test]
    fn test_worktree_path_sanitizes_branch() {
        let path = worktree_path("my-project", "feature/login");
        assert!(path.to_string_lossy().contains("feature-login"));
    }
}
