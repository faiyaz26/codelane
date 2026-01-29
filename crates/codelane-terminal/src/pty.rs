//! PTY management using portable-pty

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::path::Path;

use crate::{Error, Result, TerminalSize};

/// PTY pair wrapper
pub struct PtyHandle {
    pub master: Box<dyn MasterPty + Send>,
}

impl PtyHandle {
    /// Spawn a new PTY with the given shell
    pub fn spawn(
        shell: &str,
        working_dir: &Path,
        env: &[(String, String)],
        size: TerminalSize,
    ) -> Result<Self> {
        let pty_system = native_pty_system();

        let pty_size = PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(pty_size)
            .map_err(|e| Error::Pty(e.to_string()))?;

        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(working_dir);

        for (key, value) in env {
            cmd.env(key, value);
        }

        pair.slave
            .spawn_command(cmd)
            .map_err(|e| Error::Pty(e.to_string()))?;

        Ok(Self {
            master: pair.master,
        })
    }

    /// Resize the PTY
    pub fn resize(&self, size: TerminalSize) -> Result<()> {
        self.master
            .resize(PtySize {
                rows: size.rows,
                cols: size.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| Error::Pty(e.to_string()))
    }
}
