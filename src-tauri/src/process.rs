//! Process monitoring for terminal sessions

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

/// Cached system instance for efficient process monitoring
static SYSTEM: Mutex<Option<System>> = Mutex::new(None);

fn get_system() -> std::sync::MutexGuard<'static, Option<System>> {
    let mut guard = SYSTEM.lock().unwrap();
    if guard.is_none() {
        // Create system with minimal refresh - only what we need
        *guard = Some(System::new_with_specifics(
            RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
        ));
    }
    guard
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStats {
    pub pid: u32,
    pub cpu_usage: f32,      // Percentage
    pub memory_usage: u64,   // Bytes
    pub memory_usage_mb: f64, // Megabytes for display
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
}

/// Find process PID by environment variable (lane ID)
#[tauri::command]
pub fn find_process_by_lane(lane_id: String) -> Result<Option<u32>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Use ps to find processes with CODELANE_LANE_ID env var
        // macOS-specific: use ps with -E flag to show environment
        let output = Command::new("sh")
            .arg("-c")
            .arg(format!(
                "ps -eo pid,command | grep -v grep | grep 'CODELANE_LANE_ID={}' | awk '{{print $1}}' | head -1",
                lane_id
            ))
            .output()
            .map_err(|e| format!("Failed to execute ps command: {}", e))?;

        if output.status.success() {
            let pid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !pid_str.is_empty() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return Ok(Some(pid));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;

        // Linux: use /proc filesystem
        let output = Command::new("sh")
            .arg("-c")
            .arg(format!(
                "grep -l 'CODELANE_LANE_ID={}' /proc/*/environ 2>/dev/null | head -1 | cut -d/ -f3",
                lane_id
            ))
            .output()
            .map_err(|e| format!("Failed to execute grep command: {}", e))?;

        if output.status.success() {
            let pid_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !pid_str.is_empty() {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return Ok(Some(pid));
                }
            }
        }
    }

    Ok(None)
}

/// Get process statistics for a given PID
#[tauri::command]
pub fn get_process_stats(pid: u32) -> Result<ProcessStats, String> {
    let mut system_guard = get_system();
    let system = system_guard.as_mut().unwrap();

    let sys_pid = Pid::from_u32(pid);

    // Only refresh the specific process, not all processes
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[sys_pid]),
        true, // remove dead processes
        ProcessRefreshKind::everything(),
    );

    if let Some(process) = system.process(sys_pid) {
        let memory_bytes = process.memory();
        let memory_mb = memory_bytes as f64 / 1024.0 / 1024.0;

        Ok(ProcessStats {
            pid,
            cpu_usage: process.cpu_usage(),
            memory_usage: memory_bytes,
            memory_usage_mb: memory_mb,
        })
    } else {
        Err(format!("Process {} not found", pid))
    }
}
