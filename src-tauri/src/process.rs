//! Process monitoring for terminal sessions and app resource usage

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System, MemoryRefreshKind};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppResourceUsage {
    pub cpu_percent: f32,      // CPU usage percentage
    pub memory_mb: f64,        // Memory usage in MB
    pub memory_percent: f32,   // Memory usage as percentage of total system memory
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

/// Get resource usage for the Codelane app (including all child processes like WebView)
#[tauri::command]
pub fn get_app_resource_usage() -> Result<AppResourceUsage, String> {
    let mut system_guard = get_system();
    let system = system_guard.as_mut().unwrap();

    // Get current process PID
    let current_pid = Pid::from_u32(std::process::id());

    // Refresh memory info and all processes to find children
    system.refresh_memory_specifics(MemoryRefreshKind::everything());
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::everything(),
    );

    // Collect all processes that are part of this app (current + children)
    let mut total_memory: u64 = 0;
    let mut total_cpu: f32 = 0.0;
    let mut process_count = 0;

    // Find all child processes recursively
    let mut pids_to_check = vec![current_pid];
    let mut checked_pids = std::collections::HashSet::new();

    while let Some(pid) = pids_to_check.pop() {
        if checked_pids.contains(&pid) {
            continue;
        }
        checked_pids.insert(pid);

        if let Some(process) = system.process(pid) {
            total_memory += process.memory();
            total_cpu += process.cpu_usage();
            process_count += 1;

            // Find children of this process
            for (child_pid, child_process) in system.processes() {
                if child_process.parent() == Some(pid) && !checked_pids.contains(child_pid) {
                    pids_to_check.push(*child_pid);
                }
            }
        }
    }

    if process_count > 0 {
        let memory_mb = total_memory as f64 / 1024.0 / 1024.0;
        let total_system_memory = system.total_memory();
        let memory_percent = if total_system_memory > 0 {
            (total_memory as f64 / total_system_memory as f64 * 100.0) as f32
        } else {
            0.0
        };

        Ok(AppResourceUsage {
            cpu_percent: total_cpu,
            memory_mb,
            memory_percent,
        })
    } else {
        Err("Could not get app process info".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // Serialization tests
    // =========================================================================

    #[test]
    fn test_process_stats_serialization() {
        let stats = ProcessStats {
            pid: 12345,
            cpu_usage: 25.5,
            memory_usage: 104857600, // 100 MB
            memory_usage_mb: 100.0,
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"pid\":12345"));
        assert!(json.contains("\"cpuUsage\":25.5")); // camelCase from serde rename
        assert!(json.contains("\"memoryUsageMb\":100.0"));
    }

    #[test]
    fn test_process_stats_deserialization() {
        let json = r#"{"pid":12345,"cpuUsage":25.5,"memoryUsage":104857600,"memoryUsageMb":100.0}"#;
        let stats: ProcessStats = serde_json::from_str(json).unwrap();

        assert_eq!(stats.pid, 12345);
        assert!((stats.cpu_usage - 25.5).abs() < 0.001);
        assert_eq!(stats.memory_usage, 104857600);
        assert!((stats.memory_usage_mb - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_process_info_serialization() {
        let info = ProcessInfo {
            pid: 1234,
            name: "test-process".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"pid\":1234"));
        assert!(json.contains("\"name\":\"test-process\""));
    }

    #[test]
    fn test_app_resource_usage_serialization() {
        let usage = AppResourceUsage {
            cpu_percent: 15.5,
            memory_mb: 256.0,
            memory_percent: 1.5,
        };

        let json = serde_json::to_string(&usage).unwrap();
        assert!(json.contains("\"cpuPercent\":15.5"));
        assert!(json.contains("\"memoryMb\":256.0"));
        assert!(json.contains("\"memoryPercent\":1.5"));
    }

    #[test]
    fn test_app_resource_usage_deserialization() {
        let json = r#"{"cpuPercent":15.5,"memoryMb":256.0,"memoryPercent":1.5}"#;
        let usage: AppResourceUsage = serde_json::from_str(json).unwrap();

        assert!((usage.cpu_percent - 15.5).abs() < 0.001);
        assert!((usage.memory_mb - 256.0).abs() < 0.001);
        assert!((usage.memory_percent - 1.5).abs() < 0.001);
    }

    // =========================================================================
    // get_process_stats tests
    // =========================================================================

    #[test]
    fn test_get_process_stats_current_process() {
        // Get stats for the current test process
        let current_pid = std::process::id();
        let result = get_process_stats(current_pid);

        assert!(result.is_ok());
        let stats = result.unwrap();
        assert_eq!(stats.pid, current_pid);
        // Memory should be non-zero
        assert!(stats.memory_usage > 0);
        assert!(stats.memory_usage_mb > 0.0);
        // CPU usage may be 0 if process is idle, but should be non-negative
        assert!(stats.cpu_usage >= 0.0);
    }

    #[test]
    fn test_get_process_stats_invalid_pid() {
        // Use a very high PID that is unlikely to exist
        let result = get_process_stats(4294967295);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_get_process_stats_zero_pid() {
        // PID 0 is the kernel on most systems, may or may not be accessible
        let result = get_process_stats(0);

        // Either succeeds or fails with "not found" - both are valid
        match result {
            Ok(stats) => assert_eq!(stats.pid, 0),
            Err(e) => assert!(e.contains("not found")),
        }
    }

    // =========================================================================
    // get_app_resource_usage tests
    // =========================================================================

    #[test]
    fn test_get_app_resource_usage() {
        let result = get_app_resource_usage();

        assert!(result.is_ok());
        let usage = result.unwrap();

        // CPU and memory should be non-negative
        assert!(usage.cpu_percent >= 0.0);
        assert!(usage.memory_mb >= 0.0);
        assert!(usage.memory_percent >= 0.0);

        // Memory percentage should be reasonable (< 100%)
        assert!(usage.memory_percent <= 100.0);
    }

    // =========================================================================
    // get_system helper tests
    // =========================================================================

    #[test]
    fn test_get_system_initialization() {
        // Call get_system multiple times - should work and reuse the instance
        {
            let guard1 = get_system();
            assert!(guard1.is_some());
        }
        {
            let guard2 = get_system();
            assert!(guard2.is_some());
        }
    }

    #[test]
    fn test_get_system_thread_safety() {
        use std::thread;

        // Spawn multiple threads accessing get_system
        let handles: Vec<_> = (0..4)
            .map(|_| {
                thread::spawn(|| {
                    let guard = get_system();
                    assert!(guard.is_some());
                })
            })
            .collect();

        for handle in handles {
            handle.join().expect("Thread panicked");
        }
    }

    // =========================================================================
    // Memory calculation tests
    // =========================================================================

    #[test]
    fn test_memory_mb_calculation() {
        // Verify the memory conversion logic
        let bytes: u64 = 104857600; // 100 MB exactly
        let mb = bytes as f64 / 1024.0 / 1024.0;
        assert!((mb - 100.0).abs() < 0.001);

        let bytes: u64 = 1073741824; // 1 GB exactly
        let mb = bytes as f64 / 1024.0 / 1024.0;
        assert!((mb - 1024.0).abs() < 0.001);
    }
}
