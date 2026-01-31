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

    // Build the command
    let mut cmd = CommandBuilder::new(&shell_cmd);

    // Add arguments if provided
    if let Some(cmd_args) = args {
        for arg in cmd_args {
            cmd.arg(arg);
        }
    } else if shell_cmd.contains("zsh") || shell_cmd.contains("bash") {
        // For zsh/bash without explicit args, use login shell mode
        cmd.arg("-l");  // Login shell
        cmd.arg("-i");  // Interactive
    }

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

    // Clone the reader for the background thread
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

    let id_clone = terminal_id.clone();
    let app_clone = app.clone();

    // Spawn a background thread to read PTY output and emit events
    thread::spawn(move || {
        read_pty_output(reader, id_clone, app_clone);
    });

    // Create the terminal instance (writer taken lazily on first write)
    let instance = TerminalInstance {
        master: pair.master,
        writer: None,
        child,
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

    #[test]
    fn test_terminal_state_creation() {
        let state = TerminalState::new();
        let terminals = state.terminals.lock().unwrap();
        assert!(terminals.is_empty());
    }

    #[test]
    fn test_terminal_output_payload_serialization() {
        let payload = TerminalOutputPayload {
            id: "test-id".to_string(),
            data: "hello world".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("hello world"));
    }

    #[test]
    fn test_terminal_exit_payload_serialization() {
        let payload = TerminalExitPayload {
            id: "test-id".to_string(),
            code: Some(0),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("0"));
    }

    #[test]
    fn test_terminal_info_serialization() {
        let info = TerminalInfo {
            id: "test-id".to_string(),
            cols: 80,
            rows: 24,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("test-id"));
        assert!(json.contains("80"));
        assert!(json.contains("24"));
    }

    #[test]
    fn test_default_terminal_state() {
        let state = TerminalState::default();
        let terminals = state.terminals.lock().unwrap();
        assert!(terminals.is_empty());
    }
}
