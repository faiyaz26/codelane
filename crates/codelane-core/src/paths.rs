//! Centralized path resolution for Codelane.
//!
//! All data is stored under `~/.codelane/<env>/` where `<env>` is:
//! - `dev`  — debug builds (`cargo dev`, `pnpm tauri dev`)
//! - `prod` — release builds
//!
//! This ensures dev and prod never share databases, worktrees, settings, or lane state.

use std::path::PathBuf;

/// Returns the environment subdirectory name based on build profile.
pub fn env_name() -> &'static str {
    if cfg!(debug_assertions) {
        "dev"
    } else {
        "prod"
    }
}

/// Returns the root data directory for the current environment.
///
/// - Dev:  `~/.codelane/dev/`
/// - Prod: `~/.codelane/prod/`
///
/// Creates the directory if it doesn't exist.
pub fn data_dir() -> crate::Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| crate::Error::Config("Could not determine home directory".into()))?;
    let dir = PathBuf::from(home).join(".codelane").join(env_name());
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Returns the settings file path for the current environment.
pub fn settings_path() -> crate::Result<PathBuf> {
    Ok(data_dir()?.join("settings.json"))
}

/// Returns the database file path for the current environment.
pub fn db_path() -> crate::Result<PathBuf> {
    Ok(data_dir()?.join("codelane.db"))
}

/// Returns the lanes storage directory for the current environment.
pub fn lanes_dir() -> crate::Result<PathBuf> {
    let dir = data_dir()?.join("lanes");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Returns the worktree path for a given project and branch.
pub fn worktree_path(project_name: &str, branch: &str) -> crate::Result<PathBuf> {
    let safe_branch = branch.replace('/', "-");
    Ok(data_dir()?.join("worktrees").join(project_name).join(safe_branch))
}

/// Returns the shared hook events directory (not environment-specific).
///
/// Hook scripts write JSON event files here when agents need input.
/// Shared between dev and prod since events are transient and deleted after processing.
/// Example: `~/.codelane/hook-events/`
pub fn hook_events_dir() -> crate::Result<PathBuf> {
    let home = std::env::var("HOME")
        .map_err(|_| crate::Error::Config("Could not determine home directory".into()))?;
    let dir = PathBuf::from(home).join(".codelane").join("hook-events");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Returns the hook events directory for a specific lane.
///
/// Each lane has its own subdirectory for event isolation.
/// Example: `~/.codelane/hook-events/lane-123/`
pub fn lane_hook_events_dir(lane_id: &str) -> crate::Result<PathBuf> {
    let dir = hook_events_dir()?.join(lane_id);
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Returns the directory where hook scripts are stored (environment-specific).
///
/// Example: `~/.codelane/dev/hook-scripts/`
pub fn hook_scripts_dir() -> crate::Result<PathBuf> {
    let dir = data_dir()?.join("hook-scripts");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
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
        let dir = data_dir().unwrap();
        assert!(dir.to_string_lossy().contains(".codelane/dev"));
    }

    #[test]
    fn test_data_dir_is_absolute() {
        let dir = data_dir().unwrap();
        assert!(dir.is_absolute());
    }

    #[test]
    fn test_data_dir_exists() {
        let dir = data_dir().unwrap();
        assert!(dir.exists());
    }

    #[test]
    fn test_settings_path() {
        let path = settings_path().unwrap();
        assert!(path.to_string_lossy().ends_with("settings.json"));
        assert!(path.to_string_lossy().contains(".codelane/dev"));
    }

    #[test]
    fn test_db_path() {
        let path = db_path().unwrap();
        assert!(path.to_string_lossy().ends_with("codelane.db"));
        assert!(path.to_string_lossy().contains(".codelane/dev"));
    }

    #[test]
    fn test_lanes_dir() {
        let dir = lanes_dir().unwrap();
        assert!(dir.to_string_lossy().ends_with("lanes"));
        assert!(dir.exists());
    }

    #[test]
    fn test_worktree_path_sanitizes_branch() {
        let path = worktree_path("my-project", "feature/login").unwrap();
        assert!(path.to_string_lossy().contains("feature-login"));
        assert!(path.to_string_lossy().contains("my-project"));
    }

    #[test]
    fn test_worktree_path_contains_env() {
        let path = worktree_path("proj", "main").unwrap();
        assert!(path.to_string_lossy().contains(".codelane/dev/worktrees"));
    }
}
