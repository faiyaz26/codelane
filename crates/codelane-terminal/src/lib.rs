//! Terminal emulation for Codelane with ANSI escape sequence support
//!
//! This crate provides terminal emulation with:
//! - PTY management via portable-pty
//! - ANSI/VT escape sequence parsing for colors, cursor movement, and screen clearing
//! - Support for 16-color and 256-color palettes, plus RGB colors
//! - Render state extraction for WebView display

pub mod event;
pub mod pty;
pub mod renderer;
pub mod term;

mod error;

pub use error::{Error, Result};
pub use term::{Terminal, TerminalManager};
pub use renderer::{
    flags, index_to_css, CellAttributes, CursorState, RenderCell, SelectionRange,
    TerminalColor, TerminalRenderState, ANSI_COLORS_16, DEFAULT_BG, DEFAULT_FG,
};
pub use event::TerminalEvent;

/// Terminal size in columns and rows
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

impl Default for TerminalSize {
    fn default() -> Self {
        Self { cols: 80, rows: 24 }
    }
}
