//! Terminal events

use codelane_core::TerminalId;

/// Events emitted by the terminal
#[derive(Debug, Clone)]
pub enum TerminalEvent {
    /// Terminal output needs to be re-rendered
    Redraw(TerminalId),

    /// Terminal title changed
    TitleChanged(TerminalId, String),

    /// Terminal exited
    Exited(TerminalId, i32),

    /// Bell
    Bell(TerminalId),
}
