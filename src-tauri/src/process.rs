//! Process monitoring for terminal sessions

use serde::{Deserialize, Serialize};
use sysinfo::{Pid, System};

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
    #[cfg(unix)]
    {
        use std::process::Command;

        // Use ps and grep to find processes with CODELANE_LANE_ID env var
        let output = Command::new("sh")
            .arg("-c")
            .arg(format!(
                "ps eww -o pid= | while read pid; do \
                 if tr '\\0' '\\n' < /proc/$pid/environ 2>/dev/null | grep -q '^CODELANE_LANE_ID={}$'; then \
                 echo $pid; break; fi; done",
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

    // Fallback: search by process name
    let mut system = System::new_all();
    system.refresh_all();

    // Look for shell processes (zsh, bash, etc.) or agent processes (claude, aider, etc.)
    for (pid, process) in system.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("zsh") || name.contains("bash") || name.contains("claude") || name.contains("aider") {
            // Found a potential match - return the first one
            // This is not perfect but better than nothing
            return Ok(Some(pid.as_u32()));
        }
    }

    Ok(None)
}

/// Get process statistics for a given PID
#[tauri::command]
pub fn get_process_stats(pid: u32) -> Result<ProcessStats, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let sys_pid = Pid::from_u32(pid);

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
