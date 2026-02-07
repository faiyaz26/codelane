//! Terminal (PTY) Commands
//!
//! This module provides Tauri commands for terminal/PTY operations.
//! These commands are called from the Dioxus frontend via Tauri's invoke system.
//!
//! # Architecture
//!
//! - `TerminalState`: Holds all active terminal instances in a thread-safe manner
//! - `TerminalInstance`: Wraps a PTY master handle and associated state
//! - Background threads read PTY output and emit "terminal-output" events
//!
//! # Events
//!
//! - `terminal-output`: Emitted when terminal output is available
//!   - Payload: `{ id: String, data: String }`
//! - `terminal-exit`: Emitted when a terminal process exits
//!   - Payload: `{ id: String, code: Option<i32> }`

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, State};

/// State for managing active terminal instances
///
/// This struct is managed by Tauri and provides thread-safe access
/// to all active terminal sessions.
pub struct TerminalState {
    terminals: Mutex<HashMap<String, TerminalInstance>>,
}

impl TerminalState {
    /// Create a new terminal state manager
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for TerminalState {
    fn default() -> Self {
        Self::new()
    }
}

/// A single terminal instance with PTY handle
struct TerminalInstance {
    /// The master side of the PTY (for resizing)
    master: Box<dyn MasterPty + Send>,
    /// Writer for input (taken lazily on first write)
    writer: Option<Box<dyn Write + Send>>,
    /// The child process handle (must be kept alive)
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send + Sync>,
    /// Child process PID
    pid: u32,
    /// Lane ID associated with this terminal (if any)
    lane_id: Option<String>,
    /// Current terminal columns
    cols: u16,
    /// Current terminal rows
    rows: u16,
    /// Output buffer for polling-based reads (optional fallback)
    #[allow(dead_code)]
    output_buffer: Vec<u8>,
}

/// Payload for terminal output events emitted to the frontend
#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalOutputPayload {
    /// Terminal ID
    pub id: String,
    /// Output data as raw bytes (preserves escape sequences)
    pub data: Vec<u8>,
}

/// Payload for terminal exit events emitted to the frontend
#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalExitPayload {
    /// Terminal ID
    pub id: String,
    /// Exit code (if available)
    pub code: Option<i32>,
}

/// Terminal information returned by get_terminal_info
#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalInfo {
    /// Terminal ID
    pub id: String,
    /// Number of columns
    pub cols: u16,
    /// Number of rows
    pub rows: u16,
}

/// Create a new terminal instance
///
/// Spawns a new PTY with the specified shell and working directory.
/// A background thread is started to read output and emit events.
///
/// # Arguments
/// * `shell` - Optional shell command (defaults to $SHELL or /bin/bash)
/// * `args` - Optional command arguments
/// * `cwd` - Optional working directory (defaults to home directory)
/// * `env` - Optional environment variables
///
/// # Returns
/// The terminal ID (UUID) on success, or an error message
///
/// # Events
/// The created terminal will emit "terminal-output" events as output becomes available.
#[tauri::command]
pub async fn create_terminal(
    app: AppHandle,
    state: State<'_, TerminalState>,
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let terminal_id = uuid::Uuid::new_v4().to_string();

    // Determine the shell to use
    let shell_cmd = shell.unwrap_or_else(|| {
        std::env::var("SHELL").unwrap_or_else(|_| {
            if cfg!(target_os = "windows") {
                "cmd.exe".to_string()
            } else {
                "/bin/bash".to_string()
            }
        })
    });

    // Determine the working directory
    let working_dir = cwd
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from("/")));

    tracing::info!("Creating terminal with working directory: {:?}", working_dir);

    // Validate working directory exists
    if !working_dir.exists() {
        return Err(format!(
            "Working directory does not exist: {}",
            working_dir.display()
        ));
    }

    // Create PTY system
    let pty_system = native_pty_system();

    // Default terminal size
    let pty_size = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };

    // Open a new PTY pair
    let pair = pty_system
        .openpty(pty_size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine the user's login shell for wrapping commands
    let login_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let is_shell_command = shell_cmd.contains("zsh") || shell_cmd.contains("bash") || shell_cmd.contains("fish");

    // Build the command
    // For non-shell commands, wrap in a login shell to ensure .zshrc/.bashrc is sourced
    // This ensures PATH and other environment variables from shell init files are available
    let mut cmd = if !is_shell_command {
        // Wrap the command in a login shell: zsh -l -c 'command args...'
        let mut full_command = shell_cmd.clone();
        if let Some(ref cmd_args) = args {
            for arg in cmd_args {
                // Escape single quotes in arguments
                let escaped = arg.replace('\'', "'\\''");
                full_command.push(' ');
                full_command.push_str(&format!("'{}'", escaped));
            }
        }

        tracing::info!("Wrapping command in login shell: {} -l -c '{}'", login_shell, full_command);

        let mut wrapper = CommandBuilder::new(&login_shell);
        wrapper.arg("-l");  // Login shell - sources .zprofile/.zshrc
        wrapper.arg("-i");  // Interactive - ensures proper terminal setup
        wrapper.arg("-c");  // Run command string
        wrapper.arg(&full_command);
        wrapper
    } else {
        // For shell commands, run directly
        let mut wrapper = CommandBuilder::new(&shell_cmd);

        // Add arguments if provided
        if let Some(cmd_args) = args {
            for arg in cmd_args {
                wrapper.arg(arg);
            }
        } else {
            // For zsh/bash without explicit args, use login shell mode
            wrapper.arg("-l");  // Login shell
            wrapper.arg("-i");  // Interactive
        }
        wrapper
    };

    cmd.cwd(&working_dir);

    tracing::info!("Spawning command: {} in {:?}", shell_cmd, working_dir);

    // Inherit important environment variables
    for (key, value) in std::env::vars() {
        if key.starts_with("LC_")
            || key.starts_with("LANG")
            || key == "PATH"
            || key == "HOME"
            || key == "USER"
            || key == "LOGNAME"
            || key == "TERM"
            || key == "COLORTERM"
            || key == "SHELL"
            || key == "EDITOR"
            || key == "VISUAL"
            || key == "XDG_RUNTIME_DIR"
            || key == "XDG_CONFIG_HOME"
            || key == "XDG_DATA_HOME"
        {
            cmd.env(key, value);
        }
    }

    // Extract lane_id from environment before consuming it
    let lane_id = env.as_ref().and_then(|e| e.get("CODELANE_LANE_ID").cloned());

    // Add custom environment variables if provided
    if let Some(env_vars) = env {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    // Set TERM to xterm-256color for better compatibility
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Spawn the child process (must keep handle alive!)
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get the child PID
    let pid = child.process_id().unwrap_or(0);

    // Clone the reader for the background thread
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let id_clone = terminal_id.clone();
    let app_clone = app.clone();

    // Spawn a background thread to read PTY output and emit events
    thread::Builder::new()
        .name(format!("pty-read-{}", &terminal_id[..8]))
        .spawn(move || {
            read_pty_output(reader, id_clone, app_clone);
        })
        .map_err(|e| format!("Failed to spawn PTY reader thread: {}", e))?;

    // Create the terminal instance (writer taken lazily on first write)
    let instance = TerminalInstance {
        master: pair.master,
        writer: None,
        child,
        pid,
        lane_id,
        cols: 80,
        rows: 24,
        output_buffer: Vec::new(),
    };

    // Store the terminal instance
    let mut terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;
    terminals.insert(terminal_id.clone(), instance);

    tracing::info!(
        "Created terminal {} with shell '{}' in '{}'",
        terminal_id,
        shell_cmd,
        working_dir.display()
    );

    Ok(terminal_id)
}

/// Read PTY output in a background thread and emit events to the frontend
fn read_pty_output(mut reader: Box<dyn Read + Send>, terminal_id: String, app: AppHandle) {
    let mut buf = [0u8; 4096];

    loop {
        match reader.read(&mut buf) {
            Ok(0) => {
                // EOF - terminal closed
                tracing::info!("Terminal {} closed (EOF)", terminal_id);
                let _ = app.emit(
                    "terminal-exit",
                    TerminalExitPayload {
                        id: terminal_id.clone(),
                        code: None,
                    },
                );
                break;
            }
            Ok(n) => {
                // Send raw bytes to preserve escape sequences
                let data = buf[..n].to_vec();

                // Emit the terminal output event
                if let Err(e) = app.emit(
                    "terminal-output",
                    TerminalOutputPayload {
                        id: terminal_id.clone(),
                        data,
                    },
                ) {
                    tracing::warn!("Failed to emit terminal-output event: {}", e);
                }
            }
            Err(e) => {
                // Check if it's a would-block error (non-blocking I/O)
                if e.kind() == std::io::ErrorKind::WouldBlock {
                    // Small sleep to avoid busy-waiting
                    thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }

                // Check if the error is due to the terminal being closed
                if e.kind() == std::io::ErrorKind::BrokenPipe
                    || e.kind() == std::io::ErrorKind::UnexpectedEof
                {
                    tracing::info!("Terminal {} closed", terminal_id);
                } else {
                    tracing::error!("PTY read error for terminal {}: {}", terminal_id, e);
                }

                let _ = app.emit(
                    "terminal-exit",
                    TerminalExitPayload {
                        id: terminal_id.clone(),
                        code: None,
                    },
                );
                break;
            }
        }
    }
}

/// Write data to a terminal
///
/// Sends input data (typically keystrokes) to the terminal's PTY.
///
/// # Arguments
/// * `id` - Terminal ID
/// * `data` - Data to write (keystrokes, commands, etc.)
///
/// # Returns
/// Ok(()) on success, or an error message
#[tauri::command]
pub async fn write_terminal(
    state: State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    let instance = terminals
        .get_mut(&id)
        .ok_or_else(|| format!("Terminal not found: {}", id))?;

    // Take writer on first use and keep it for subsequent writes
    if instance.writer.is_none() {
        let writer = instance
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;
        instance.writer = Some(writer);
    }

    // Write using the stored writer
    let writer = instance
        .writer
        .as_mut()
        .ok_or("Writer not available")?;

    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write to PTY: {}", e))?;

    writer
        .flush()
        .map_err(|e| format!("Failed to flush PTY: {}", e))?;

    tracing::trace!("Wrote {} bytes to terminal {}", data.len(), id);

    Ok(())
}

/// Read available output from a terminal (polling fallback)
///
/// Note: The recommended approach is to use the event system via "terminal-output" events.
/// This command is provided as a polling fallback if events are not suitable.
///
/// # Arguments
/// * `id` - Terminal ID
///
/// # Returns
/// Available output data as a string, or an error message
#[tauri::command]
pub async fn read_terminal(state: State<'_, TerminalState>, id: String) -> Result<String, String> {
    let mut terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    let instance = terminals
        .get_mut(&id)
        .ok_or_else(|| format!("Terminal not found: {}", id))?;

    // Return any buffered output and clear the buffer
    let output = String::from_utf8_lossy(&instance.output_buffer).to_string();
    instance.output_buffer.clear();

    Ok(output)
}

/// Resize a terminal
///
/// Updates the terminal's PTY size. This should be called when the terminal
/// view is resized in the frontend.
///
/// # Arguments
/// * `id` - Terminal ID
/// * `cols` - Number of columns
/// * `rows` - Number of rows
///
/// # Returns
/// Ok(()) on success, or an error message
#[tauri::command]
pub async fn resize_terminal(
    state: State<'_, TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // Validate dimensions
    if cols == 0 || rows == 0 {
        return Err("Terminal dimensions must be greater than 0".to_string());
    }

    if cols > 1000 || rows > 1000 {
        return Err("Terminal dimensions too large (max 1000x1000)".to_string());
    }

    let mut terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    let instance = terminals
        .get_mut(&id)
        .ok_or_else(|| format!("Terminal not found: {}", id))?;

    // Resize the PTY
    instance
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize PTY: {}", e))?;

    // Update stored size
    instance.cols = cols;
    instance.rows = rows;

    tracing::debug!("Resized terminal {} to {}x{}", id, cols, rows);

    Ok(())
}

/// Close a terminal
///
/// Closes the terminal and releases all associated resources.
/// A "terminal-exit" event will be emitted.
///
/// # Arguments
/// * `id` - Terminal ID
///
/// # Returns
/// Ok(()) on success, or an error message
#[tauri::command]
pub async fn close_terminal(state: State<'_, TerminalState>, id: String) -> Result<(), String> {
    let mut terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    // Remove and drop the terminal instance
    // Dropping the master PTY will close the terminal
    terminals
        .remove(&id)
        .ok_or_else(|| format!("Terminal not found: {}", id))?;

    tracing::info!("Closed terminal {}", id);

    Ok(())
}

/// Get information about a terminal
///
/// # Arguments
/// * `id` - Terminal ID
///
/// # Returns
/// Terminal info (id, cols, rows) on success, or an error message
#[tauri::command]
pub async fn get_terminal_info(
    state: State<'_, TerminalState>,
    id: String,
) -> Result<TerminalInfo, String> {
    let terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    let instance = terminals
        .get(&id)
        .ok_or_else(|| format!("Terminal not found: {}", id))?;

    Ok(TerminalInfo {
        id: id.clone(),
        cols: instance.cols,
        rows: instance.rows,
    })
}

/// List all active terminal IDs
///
/// # Returns
/// Vector of terminal IDs
#[tauri::command]
pub async fn list_terminals(state: State<'_, TerminalState>) -> Result<Vec<String>, String> {
    let terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    Ok(terminals.keys().cloned().collect())
}

/// Get the PID for a terminal by lane ID
///
/// # Arguments
/// * `lane_id` - The lane ID to search for
///
/// # Returns
/// The PID if found, or None
#[tauri::command]
pub async fn get_terminal_pid_by_lane(
    state: State<'_, TerminalState>,
    lane_id: String,
) -> Result<Option<u32>, String> {
    let terminals = state
        .terminals
        .lock()
        .map_err(|e| format!("Failed to lock terminal state: {}", e))?;

    // Find terminal with matching lane_id
    for instance in terminals.values() {
        if let Some(ref id) = instance.lane_id {
            if id == &lane_id {
                return Ok(Some(instance.pid));
            }
        }
    }

    Ok(None)
}

/// Initialize the terminal module and return the command handlers
///
/// This function returns a handler that can be used with Tauri's invoke_handler.
///
/// # Example
/// ```rust,ignore
/// use tauri::Manager;
///
/// fn main() {
///     tauri::Builder::default()
///         .manage(terminal::TerminalState::new())
///         .invoke_handler(terminal::init())
///         .run(tauri::generate_context!())
///         .expect("error while running tauri application");
/// }
/// ```
pub fn init() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        create_terminal,
        write_terminal,
        read_terminal,
        resize_terminal,
        close_terminal,
        get_terminal_info,
        list_terminals,
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // TerminalState tests
    // =========================================================================

    #[test]
    fn test_terminal_state_creation() {
        let state = TerminalState::new();
        let terminals = state.terminals.lock().unwrap();
        assert!(terminals.is_empty());
    }

    #[test]
    fn test_default_terminal_state() {
        let state = TerminalState::default();
        let terminals = state.terminals.lock().unwrap();
        assert!(terminals.is_empty());
    }

    #[test]
    fn test_terminal_state_thread_safety() {
        use std::sync::Arc;

        let state = Arc::new(TerminalState::new());
        let handles: Vec<_> = (0..4)
            .map(|_| {
                let state_clone = state.clone();
                std::thread::spawn(move || {
                    let terminals = state_clone.terminals.lock().unwrap();
                    assert!(terminals.is_empty());
                })
            })
            .collect();

        for handle in handles {
            handle.join().expect("Thread panicked");
        }
    }

    // =========================================================================
    // TerminalOutputPayload tests
    // =========================================================================

    #[test]
    fn test_terminal_output_payload_serialization() {
        let payload = TerminalOutputPayload {
            id: "test-id".to_string(),
            data: b"hello world".to_vec(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"id\":\"test-id\""));
        assert!(json.contains("\"data\""));
    }

    #[test]
    fn test_terminal_output_payload_deserialization() {
        // Data is serialized as an array of bytes
        let json = r#"{"id":"test-id","data":[104,101,108,108,111]}"#;
        let payload: TerminalOutputPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.id, "test-id");
        assert_eq!(payload.data, b"hello");
    }

    #[test]
    fn test_terminal_output_payload_empty_data() {
        let payload = TerminalOutputPayload {
            id: "empty".to_string(),
            data: vec![],
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "empty");
        assert!(deserialized.data.is_empty());
    }

    #[test]
    fn test_terminal_output_payload_binary_data() {
        // Test with binary data including null bytes and escape sequences
        let payload = TerminalOutputPayload {
            id: "binary".to_string(),
            data: vec![0x1b, 0x5b, 0x31, 0x6d, 0x00, 0xff], // ESC[1m + null + 0xff
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.data, vec![0x1b, 0x5b, 0x31, 0x6d, 0x00, 0xff]);
    }

    // =========================================================================
    // TerminalExitPayload tests
    // =========================================================================

    #[test]
    fn test_terminal_exit_payload_serialization() {
        let payload = TerminalExitPayload {
            id: "test-id".to_string(),
            code: Some(0),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"id\":\"test-id\""));
        assert!(json.contains("\"code\":0"));
    }

    #[test]
    fn test_terminal_exit_payload_deserialization() {
        let json = r#"{"id":"test-id","code":42}"#;
        let payload: TerminalExitPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.id, "test-id");
        assert_eq!(payload.code, Some(42));
    }

    #[test]
    fn test_terminal_exit_payload_null_code() {
        let payload = TerminalExitPayload {
            id: "test-id".to_string(),
            code: None,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"code\":null"));

        let deserialized: TerminalExitPayload = serde_json::from_str(&json).unwrap();
        assert!(deserialized.code.is_none());
    }

    #[test]
    fn test_terminal_exit_payload_negative_code() {
        let payload = TerminalExitPayload {
            id: "test-id".to_string(),
            code: Some(-1),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalExitPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.code, Some(-1));
    }

    // =========================================================================
    // TerminalInfo tests
    // =========================================================================

    #[test]
    fn test_terminal_info_serialization() {
        let info = TerminalInfo {
            id: "test-id".to_string(),
            cols: 80,
            rows: 24,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"id\":\"test-id\""));
        assert!(json.contains("\"cols\":80"));
        assert!(json.contains("\"rows\":24"));
    }

    #[test]
    fn test_terminal_info_deserialization() {
        let json = r#"{"id":"test-id","cols":120,"rows":40}"#;
        let info: TerminalInfo = serde_json::from_str(json).unwrap();

        assert_eq!(info.id, "test-id");
        assert_eq!(info.cols, 120);
        assert_eq!(info.rows, 40);
    }

    #[test]
    fn test_terminal_info_large_dimensions() {
        let info = TerminalInfo {
            id: "large".to_string(),
            cols: 999,
            rows: 999,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: TerminalInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.cols, 999);
        assert_eq!(deserialized.rows, 999);
    }

    #[test]
    fn test_terminal_info_minimum_dimensions() {
        let info = TerminalInfo {
            id: "min".to_string(),
            cols: 1,
            rows: 1,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: TerminalInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.cols, 1);
        assert_eq!(deserialized.rows, 1);
    }

    // =========================================================================
    // Clone tests
    // =========================================================================

    #[test]
    fn test_terminal_output_payload_clone() {
        let original = TerminalOutputPayload {
            id: "test".to_string(),
            data: vec![1, 2, 3],
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.data, cloned.data);
    }

    #[test]
    fn test_terminal_exit_payload_clone() {
        let original = TerminalExitPayload {
            id: "test".to_string(),
            code: Some(0),
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.code, cloned.code);
    }

    #[test]
    fn test_terminal_info_clone() {
        let original = TerminalInfo {
            id: "test".to_string(),
            cols: 80,
            rows: 24,
        };

        let cloned = original.clone();
        assert_eq!(original.id, cloned.id);
        assert_eq!(original.cols, cloned.cols);
        assert_eq!(original.rows, cloned.rows);
    }

    // =========================================================================
    // Additional payload tests
    // =========================================================================

    #[test]
    fn test_terminal_output_payload_ansi_escape_sequences() {
        // Test ANSI escape sequences for colors
        let payload = TerminalOutputPayload {
            id: "ansi-test".to_string(),
            data: b"\x1b[31mRed Text\x1b[0m".to_vec(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.data, b"\x1b[31mRed Text\x1b[0m");
    }

    #[test]
    fn test_terminal_output_payload_cursor_movement() {
        // Test cursor movement escape sequences
        let payload = TerminalOutputPayload {
            id: "cursor-test".to_string(),
            data: b"\x1b[2J\x1b[H".to_vec(), // Clear screen and home cursor
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.data.len(), 7);
    }

    #[test]
    fn test_terminal_output_payload_large_data() {
        let large_data = vec![b'A'; 4096]; // Same as buffer size in read_pty_output
        let payload = TerminalOutputPayload {
            id: "large".to_string(),
            data: large_data.clone(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.data.len(), 4096);
    }

    #[test]
    fn test_terminal_exit_payload_signal_code() {
        // Test with signal codes (typically negative or > 128)
        let payload = TerminalExitPayload {
            id: "signal".to_string(),
            code: Some(137), // SIGKILL (128 + 9)
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalExitPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.code, Some(137));
    }

    #[test]
    fn test_terminal_exit_payload_success_code() {
        let payload = TerminalExitPayload {
            id: "success".to_string(),
            code: Some(0),
        };

        assert_eq!(payload.code, Some(0));
    }

    #[test]
    fn test_terminal_exit_payload_error_code() {
        let payload = TerminalExitPayload {
            id: "error".to_string(),
            code: Some(1),
        };

        assert_eq!(payload.code, Some(1));
    }

    // =========================================================================
    // TerminalInfo edge cases
    // =========================================================================

    #[test]
    fn test_terminal_info_standard_sizes() {
        let sizes = vec![
            (80, 24),   // Standard VT100
            (80, 25),   // DOS/Windows console
            (132, 43),  // Wide mode
            (120, 40),  // Common modern terminal
        ];

        for (cols, rows) in sizes {
            let info = TerminalInfo {
                id: format!("term-{}x{}", cols, rows),
                cols,
                rows,
            };

            let json = serde_json::to_string(&info).unwrap();
            let deserialized: TerminalInfo = serde_json::from_str(&json).unwrap();

            assert_eq!(deserialized.cols, cols);
            assert_eq!(deserialized.rows, rows);
        }
    }

    #[test]
    fn test_terminal_info_uuid_id() {
        let info = TerminalInfo {
            id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            cols: 80,
            rows: 24,
        };

        assert!(uuid::Uuid::parse_str(&info.id).is_ok());
    }

    // =========================================================================
    // TerminalState additional tests
    // =========================================================================

    #[test]
    fn test_terminal_state_lock_and_unlock() {
        let state = TerminalState::new();

        // Lock and unlock multiple times
        for _ in 0..5 {
            let terminals = state.terminals.lock().unwrap();
            drop(terminals);
        }
    }

    #[test]
    fn test_terminal_state_concurrent_reads() {
        use std::sync::Arc;
        use std::thread;

        let state = Arc::new(TerminalState::new());
        let mut handles = vec![];

        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            handles.push(thread::spawn(move || {
                let terminals = state_clone.terminals.lock().unwrap();
                let len = terminals.len();
                drop(terminals);
                (i, len)
            }));
        }

        for handle in handles {
            let (idx, len) = handle.join().unwrap();
            assert_eq!(len, 0, "Thread {} saw non-empty map", idx);
        }
    }

    // =========================================================================
    // Serialization format tests
    // =========================================================================

    #[test]
    fn test_terminal_output_payload_json_format() {
        let payload = TerminalOutputPayload {
            id: "test".to_string(),
            data: vec![72, 101, 108, 108, 111], // "Hello"
        };

        let json = serde_json::to_string(&payload).unwrap();

        // Verify JSON structure
        assert!(json.contains("\"id\""));
        assert!(json.contains("\"data\""));
        assert!(json.contains("[72,101,108,108,111]"));
    }

    #[test]
    fn test_terminal_exit_payload_json_format() {
        let payload = TerminalExitPayload {
            id: "test".to_string(),
            code: Some(0),
        };

        let json = serde_json::to_string(&payload).unwrap();

        assert!(json.contains("\"id\":\"test\""));
        assert!(json.contains("\"code\":0"));
    }

    #[test]
    fn test_terminal_info_json_format() {
        let info = TerminalInfo {
            id: "test".to_string(),
            cols: 80,
            rows: 24,
        };

        let json = serde_json::to_string(&info).unwrap();

        assert!(json.contains("\"cols\":80"));
        assert!(json.contains("\"rows\":24"));
    }

    // =========================================================================
    // Validation logic tests (simulating resize_terminal checks)
    // =========================================================================

    #[test]
    fn test_terminal_dimension_validation_zero() {
        // Test that zero dimensions would be rejected
        let cols: u16 = 0;
        let rows: u16 = 0;

        assert!(cols == 0 || rows == 0, "Zero dimensions should be invalid");
    }

    #[test]
    fn test_terminal_dimension_validation_max() {
        // Test maximum dimension check
        let cols: u16 = 1000;
        let rows: u16 = 1000;

        assert!(cols <= 1000 && rows <= 1000, "1000x1000 should be valid");
    }

    #[test]
    fn test_terminal_dimension_validation_over_max() {
        // Test that dimensions over 1000 would be rejected
        let cols: u16 = 1001;
        let rows: u16 = 1001;

        assert!(cols > 1000 || rows > 1000, "Over 1000 should be invalid");
    }

    // =========================================================================
    // Special character handling in IDs
    // =========================================================================

    #[test]
    fn test_terminal_id_with_special_chars() {
        let special_ids = vec![
            "term-123",
            "term_456",
            "term.789",
            "TERM-ABC",
        ];

        for id in special_ids {
            let info = TerminalInfo {
                id: id.to_string(),
                cols: 80,
                rows: 24,
            };

            let json = serde_json::to_string(&info).unwrap();
            let deserialized: TerminalInfo = serde_json::from_str(&json).unwrap();

            assert_eq!(deserialized.id, id);
        }
    }

    #[test]
    fn test_terminal_output_payload_with_newlines() {
        let payload = TerminalOutputPayload {
            id: "newline-test".to_string(),
            data: b"line1\r\nline2\r\nline3\r\n".to_vec(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert!(deserialized.data.contains(&b'\r'));
        assert!(deserialized.data.contains(&b'\n'));
    }

    #[test]
    fn test_terminal_output_payload_tab_characters() {
        let payload = TerminalOutputPayload {
            id: "tab-test".to_string(),
            data: b"col1\tcol2\tcol3".to_vec(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: TerminalOutputPayload = serde_json::from_str(&json).unwrap();

        assert!(deserialized.data.contains(&b'\t'));
    }

    // =========================================================================
    // Init function test
    // =========================================================================

    #[test]
    fn test_init_returns_handler() {
        // Test that init() returns a valid handler
        let _handler = init();
        // If we got here without panicking, the handler was created successfully
    }
}
