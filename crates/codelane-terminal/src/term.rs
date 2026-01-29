//! Terminal state management
//!
//! This module provides terminal emulation with ANSI escape sequence parsing
//! for colors, cursor movement, and screen clearing.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::Arc;

use codelane_core::TerminalId;
use parking_lot::Mutex;
use tokio::sync::mpsc;

use crate::event::TerminalEvent;
use crate::pty::PtyHandle;
use crate::renderer::{CellAttributes, CursorState, RenderCell, TerminalColor, TerminalRenderState};
use crate::{Error, Result, TerminalSize};

/// A single terminal instance
pub struct Terminal {
    id: TerminalId,
    pty: Arc<Mutex<PtyHandle>>,
    size: TerminalSize,
    buffer: Arc<Mutex<TerminalBuffer>>,
    #[allow(dead_code)]
    event_tx: mpsc::UnboundedSender<TerminalEvent>,
}

/// A cell in the terminal buffer
#[derive(Debug, Clone)]
struct Cell {
    c: char,
    attrs: CellAttributes,
}

impl Default for Cell {
    fn default() -> Self {
        Self {
            c: ' ',
            attrs: CellAttributes::default(),
        }
    }
}

/// Parser state for ANSI escape sequences
#[derive(Debug, Clone, PartialEq)]
enum ParserState {
    /// Normal character processing
    Ground,
    /// Received ESC, waiting for next character
    Escape,
    /// Received ESC [, parsing CSI sequence
    Csi,
    /// Received ESC ], parsing OSC sequence
    Osc,
    /// Received ESC [ ?, parsing private CSI sequence
    CsiPrivate,
}

/// Simple terminal buffer for storing output with ANSI support
struct TerminalBuffer {
    /// Grid of cells
    cells: Vec<Vec<Cell>>,
    /// Current cursor X position
    cursor_x: usize,
    /// Current cursor Y position
    cursor_y: usize,
    /// Number of columns
    cols: usize,
    /// Number of rows
    rows: usize,
    /// Current text attributes
    current_attrs: CellAttributes,
    /// Parser state
    parser_state: ParserState,
    /// CSI parameter buffer
    csi_params: Vec<u8>,
    /// OSC buffer
    osc_buffer: Vec<u8>,
    /// Scroll region top
    scroll_top: usize,
    /// Scroll region bottom
    scroll_bottom: usize,
    /// Saved cursor position
    saved_cursor: Option<(usize, usize)>,
    /// Cursor visible
    cursor_visible: bool,
}

impl TerminalBuffer {
    fn new(cols: usize, rows: usize) -> Self {
        Self {
            cells: vec![vec![Cell::default(); cols]; rows],
            cursor_x: 0,
            cursor_y: 0,
            cols,
            rows,
            current_attrs: CellAttributes::default(),
            parser_state: ParserState::Ground,
            csi_params: Vec::new(),
            osc_buffer: Vec::new(),
            scroll_top: 0,
            scroll_bottom: rows.saturating_sub(1),
            saved_cursor: None,
            cursor_visible: true,
        }
    }

    /// Process a single byte of input
    fn write_byte(&mut self, byte: u8) {
        match self.parser_state {
            ParserState::Ground => self.process_ground(byte),
            ParserState::Escape => self.process_escape(byte),
            ParserState::Csi => self.process_csi(byte),
            ParserState::CsiPrivate => self.process_csi_private(byte),
            ParserState::Osc => self.process_osc(byte),
        }
    }

    /// Process byte in ground state
    fn process_ground(&mut self, byte: u8) {
        match byte {
            // ESC - start escape sequence
            0x1b => {
                self.parser_state = ParserState::Escape;
            }
            // Newline
            b'\n' => {
                self.newline();
            }
            // Carriage return
            b'\r' => {
                self.cursor_x = 0;
            }
            // Backspace
            0x08 => {
                self.cursor_x = self.cursor_x.saturating_sub(1);
            }
            // Tab
            b'\t' => {
                // Move to next tab stop (every 8 columns)
                self.cursor_x = ((self.cursor_x / 8) + 1) * 8;
                if self.cursor_x >= self.cols {
                    self.cursor_x = self.cols - 1;
                }
            }
            // Bell
            0x07 => {
                // Ignore bell in ground state
            }
            // Printable characters (ASCII 32-126 and UTF-8)
            _ if byte >= 0x20 => {
                self.put_char(byte as char);
            }
            _ => {
                // Ignore other control characters
            }
        }
    }

    /// Process byte after ESC
    fn process_escape(&mut self, byte: u8) {
        match byte {
            // CSI - Control Sequence Introducer
            b'[' => {
                self.parser_state = ParserState::Csi;
                self.csi_params.clear();
            }
            // OSC - Operating System Command
            b']' => {
                self.parser_state = ParserState::Osc;
                self.osc_buffer.clear();
            }
            // RIS - Reset to Initial State
            b'c' => {
                self.reset();
                self.parser_state = ParserState::Ground;
            }
            // DECSC - Save Cursor
            b'7' => {
                self.saved_cursor = Some((self.cursor_x, self.cursor_y));
                self.parser_state = ParserState::Ground;
            }
            // DECRC - Restore Cursor
            b'8' => {
                if let Some((x, y)) = self.saved_cursor {
                    self.cursor_x = x.min(self.cols.saturating_sub(1));
                    self.cursor_y = y.min(self.rows.saturating_sub(1));
                }
                self.parser_state = ParserState::Ground;
            }
            // IND - Index (move down one line)
            b'D' => {
                self.index();
                self.parser_state = ParserState::Ground;
            }
            // NEL - Next Line
            b'E' => {
                self.cursor_x = 0;
                self.index();
                self.parser_state = ParserState::Ground;
            }
            // RI - Reverse Index (move up one line)
            b'M' => {
                self.reverse_index();
                self.parser_state = ParserState::Ground;
            }
            _ => {
                // Unknown escape sequence, return to ground
                self.parser_state = ParserState::Ground;
            }
        }
    }

    /// Process CSI sequence byte
    fn process_csi(&mut self, byte: u8) {
        match byte {
            // Private mode indicator
            b'?' => {
                self.parser_state = ParserState::CsiPrivate;
            }
            // Parameter bytes
            b'0'..=b'9' | b';' | b':' => {
                self.csi_params.push(byte);
            }
            // Final bytes - execute the sequence
            b'@'..=b'~' => {
                self.execute_csi(byte);
                self.parser_state = ParserState::Ground;
            }
            _ => {
                // Invalid sequence
                self.parser_state = ParserState::Ground;
            }
        }
    }

    /// Process private CSI sequence (ESC [ ?)
    fn process_csi_private(&mut self, byte: u8) {
        match byte {
            b'0'..=b'9' | b';' => {
                self.csi_params.push(byte);
            }
            // DECSET / DECRST
            b'h' | b'l' => {
                let params = self.parse_params();
                for param in params {
                    match param {
                        25 => {
                            // DECTCEM - cursor visibility
                            self.cursor_visible = byte == b'h';
                        }
                        1049 => {
                            // Alternate screen buffer - we just clear for now
                            if byte == b'h' {
                                self.clear_screen();
                            }
                        }
                        _ => {}
                    }
                }
                self.parser_state = ParserState::Ground;
            }
            _ => {
                self.parser_state = ParserState::Ground;
            }
        }
    }

    /// Process OSC sequence
    fn process_osc(&mut self, byte: u8) {
        match byte {
            // BEL or ST terminates OSC
            0x07 => {
                // OSC terminated - we could handle title changes here
                self.parser_state = ParserState::Ground;
            }
            // ESC might start ST (String Terminator)
            0x1b => {
                self.parser_state = ParserState::Ground;
            }
            _ => {
                self.osc_buffer.push(byte);
                // Limit buffer size
                if self.osc_buffer.len() > 4096 {
                    self.parser_state = ParserState::Ground;
                }
            }
        }
    }

    /// Parse CSI parameters
    fn parse_params(&self) -> Vec<usize> {
        if self.csi_params.is_empty() {
            return vec![];
        }

        String::from_utf8_lossy(&self.csi_params)
            .split(';')
            .map(|s| s.parse::<usize>().unwrap_or(0))
            .collect()
    }

    /// Execute a CSI sequence
    fn execute_csi(&mut self, final_byte: u8) {
        let params = self.parse_params();

        match final_byte {
            // CUU - Cursor Up
            b'A' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_y = self.cursor_y.saturating_sub(n);
            }
            // CUD - Cursor Down
            b'B' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_y = (self.cursor_y + n).min(self.rows - 1);
            }
            // CUF - Cursor Forward
            b'C' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_x = (self.cursor_x + n).min(self.cols - 1);
            }
            // CUB - Cursor Back
            b'D' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_x = self.cursor_x.saturating_sub(n);
            }
            // CNL - Cursor Next Line
            b'E' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_x = 0;
                self.cursor_y = (self.cursor_y + n).min(self.rows - 1);
            }
            // CPL - Cursor Previous Line
            b'F' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_x = 0;
                self.cursor_y = self.cursor_y.saturating_sub(n);
            }
            // CHA - Cursor Horizontal Absolute
            b'G' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_x = (n - 1).min(self.cols - 1);
            }
            // CUP / HVP - Cursor Position
            b'H' | b'f' => {
                let row = params.first().copied().unwrap_or(1).max(1);
                let col = params.get(1).copied().unwrap_or(1).max(1);
                self.cursor_y = (row - 1).min(self.rows - 1);
                self.cursor_x = (col - 1).min(self.cols - 1);
            }
            // ED - Erase in Display
            b'J' => {
                let mode = params.first().copied().unwrap_or(0);
                self.erase_display(mode);
            }
            // EL - Erase in Line
            b'K' => {
                let mode = params.first().copied().unwrap_or(0);
                self.erase_line(mode);
            }
            // IL - Insert Lines
            b'L' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.insert_lines(n);
            }
            // DL - Delete Lines
            b'M' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.delete_lines(n);
            }
            // DCH - Delete Characters
            b'P' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.delete_chars(n);
            }
            // ICH - Insert Characters
            b'@' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.insert_chars(n);
            }
            // SGR - Select Graphic Rendition
            b'm' => {
                self.process_sgr(&params);
            }
            // DECSTBM - Set Top and Bottom Margins
            b'r' => {
                let top = params.first().copied().unwrap_or(1).max(1);
                let bottom = params.get(1).copied().unwrap_or(self.rows);
                self.scroll_top = (top - 1).min(self.rows - 1);
                self.scroll_bottom = (bottom - 1).min(self.rows - 1);
                // Move cursor to home position
                self.cursor_x = 0;
                self.cursor_y = 0;
            }
            // VPA - Vertical Position Absolute
            b'd' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                self.cursor_y = (n - 1).min(self.rows - 1);
            }
            // ECH - Erase Characters
            b'X' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                for i in 0..n {
                    let x = self.cursor_x + i;
                    if x < self.cols && self.cursor_y < self.rows {
                        self.cells[self.cursor_y][x] = Cell::default();
                    }
                }
            }
            // SU - Scroll Up
            b'S' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                for _ in 0..n {
                    self.scroll_up();
                }
            }
            // SD - Scroll Down
            b'T' => {
                let n = params.first().copied().unwrap_or(1).max(1);
                for _ in 0..n {
                    self.scroll_down();
                }
            }
            _ => {
                // Unknown CSI sequence
            }
        }
    }

    /// Process SGR (Select Graphic Rendition) sequence
    fn process_sgr(&mut self, params: &[usize]) {
        if params.is_empty() {
            self.current_attrs.reset();
            return;
        }

        let mut i = 0;
        while i < params.len() {
            match params[i] {
                0 => self.current_attrs.reset(),
                1 => self.current_attrs.set_bold(true),
                2 => self.current_attrs.set_dim(true),
                3 => self.current_attrs.set_italic(true),
                4 => self.current_attrs.set_underline(true),
                5 => self.current_attrs.set_blink(true),
                7 => self.current_attrs.set_inverse(true),
                8 => self.current_attrs.set_hidden(true),
                9 => self.current_attrs.set_strikethrough(true),
                21 => self.current_attrs.set_bold(false),
                22 => {
                    self.current_attrs.set_bold(false);
                    self.current_attrs.set_dim(false);
                }
                23 => self.current_attrs.set_italic(false),
                24 => self.current_attrs.set_underline(false),
                25 => self.current_attrs.set_blink(false),
                27 => self.current_attrs.set_inverse(false),
                28 => self.current_attrs.set_hidden(false),
                29 => self.current_attrs.set_strikethrough(false),
                // Standard foreground colors (30-37)
                30..=37 => {
                    self.current_attrs.fg = TerminalColor::Indexed((params[i] - 30) as u8);
                }
                // Extended foreground color
                38 => {
                    if let Some(color) = self.parse_extended_color(params, &mut i) {
                        self.current_attrs.fg = color;
                    }
                }
                // Default foreground
                39 => self.current_attrs.fg = TerminalColor::Default,
                // Standard background colors (40-47)
                40..=47 => {
                    self.current_attrs.bg = TerminalColor::Indexed((params[i] - 40) as u8);
                }
                // Extended background color
                48 => {
                    if let Some(color) = self.parse_extended_color(params, &mut i) {
                        self.current_attrs.bg = color;
                    }
                }
                // Default background
                49 => self.current_attrs.bg = TerminalColor::Default,
                // Bright foreground colors (90-97)
                90..=97 => {
                    self.current_attrs.fg = TerminalColor::Indexed((params[i] - 90 + 8) as u8);
                }
                // Bright background colors (100-107)
                100..=107 => {
                    self.current_attrs.bg = TerminalColor::Indexed((params[i] - 100 + 8) as u8);
                }
                _ => {}
            }
            i += 1;
        }
    }

    /// Parse extended color (256-color or RGB)
    fn parse_extended_color(&self, params: &[usize], i: &mut usize) -> Option<TerminalColor> {
        if *i + 1 >= params.len() {
            return None;
        }

        match params[*i + 1] {
            // 256-color mode
            5 => {
                if *i + 2 < params.len() {
                    *i += 2;
                    Some(TerminalColor::Indexed(params[*i] as u8))
                } else {
                    None
                }
            }
            // RGB mode
            2 => {
                if *i + 4 < params.len() {
                    let r = params[*i + 2] as u8;
                    let g = params[*i + 3] as u8;
                    let b = params[*i + 4] as u8;
                    *i += 4;
                    Some(TerminalColor::Rgb(r, g, b))
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    /// Put a character at the current cursor position
    fn put_char(&mut self, c: char) {
        if self.cursor_y < self.rows && self.cursor_x < self.cols {
            self.cells[self.cursor_y][self.cursor_x] = Cell {
                c,
                attrs: self.current_attrs,
            };
            self.cursor_x += 1;
            if self.cursor_x >= self.cols {
                self.cursor_x = 0;
                self.newline();
            }
        }
    }

    /// Handle newline
    fn newline(&mut self) {
        if self.cursor_y >= self.scroll_bottom {
            self.scroll_up();
        } else {
            self.cursor_y += 1;
        }
    }

    /// Index - move cursor down, scroll if at bottom
    fn index(&mut self) {
        if self.cursor_y >= self.scroll_bottom {
            self.scroll_up();
        } else {
            self.cursor_y += 1;
        }
    }

    /// Reverse index - move cursor up, scroll if at top
    fn reverse_index(&mut self) {
        if self.cursor_y <= self.scroll_top {
            self.scroll_down();
        } else {
            self.cursor_y -= 1;
        }
    }

    /// Scroll the buffer up one line
    fn scroll_up(&mut self) {
        if self.scroll_top < self.scroll_bottom {
            self.cells.remove(self.scroll_top);
            self.cells
                .insert(self.scroll_bottom, vec![Cell::default(); self.cols]);
        }
    }

    /// Scroll the buffer down one line
    fn scroll_down(&mut self) {
        if self.scroll_top < self.scroll_bottom {
            self.cells.remove(self.scroll_bottom);
            self.cells
                .insert(self.scroll_top, vec![Cell::default(); self.cols]);
        }
    }

    /// Erase display based on mode
    fn erase_display(&mut self, mode: usize) {
        match mode {
            // Clear from cursor to end of screen
            0 => {
                // Clear current line from cursor
                self.erase_line(0);
                // Clear all lines below
                for y in (self.cursor_y + 1)..self.rows {
                    for x in 0..self.cols {
                        self.cells[y][x] = Cell::default();
                    }
                }
            }
            // Clear from beginning of screen to cursor
            1 => {
                // Clear all lines above
                for y in 0..self.cursor_y {
                    for x in 0..self.cols {
                        self.cells[y][x] = Cell::default();
                    }
                }
                // Clear current line to cursor
                self.erase_line(1);
            }
            // Clear entire screen
            2 | 3 => {
                self.clear_screen();
            }
            _ => {}
        }
    }

    /// Erase line based on mode
    fn erase_line(&mut self, mode: usize) {
        if self.cursor_y >= self.rows {
            return;
        }

        match mode {
            // Clear from cursor to end of line
            0 => {
                for x in self.cursor_x..self.cols {
                    self.cells[self.cursor_y][x] = Cell::default();
                }
            }
            // Clear from beginning of line to cursor
            1 => {
                for x in 0..=self.cursor_x.min(self.cols - 1) {
                    self.cells[self.cursor_y][x] = Cell::default();
                }
            }
            // Clear entire line
            2 => {
                for x in 0..self.cols {
                    self.cells[self.cursor_y][x] = Cell::default();
                }
            }
            _ => {}
        }
    }

    /// Clear the entire screen
    fn clear_screen(&mut self) {
        for row in &mut self.cells {
            for cell in row {
                *cell = Cell::default();
            }
        }
        self.cursor_x = 0;
        self.cursor_y = 0;
    }

    /// Reset terminal state
    fn reset(&mut self) {
        self.clear_screen();
        self.current_attrs = CellAttributes::default();
        self.scroll_top = 0;
        self.scroll_bottom = self.rows.saturating_sub(1);
        self.saved_cursor = None;
        self.cursor_visible = true;
    }

    /// Insert lines at cursor position
    fn insert_lines(&mut self, n: usize) {
        for _ in 0..n {
            if self.cursor_y <= self.scroll_bottom {
                self.cells.remove(self.scroll_bottom);
                self.cells
                    .insert(self.cursor_y, vec![Cell::default(); self.cols]);
            }
        }
    }

    /// Delete lines at cursor position
    fn delete_lines(&mut self, n: usize) {
        for _ in 0..n {
            if self.cursor_y <= self.scroll_bottom {
                self.cells.remove(self.cursor_y);
                self.cells
                    .insert(self.scroll_bottom, vec![Cell::default(); self.cols]);
            }
        }
    }

    /// Delete characters at cursor position
    fn delete_chars(&mut self, n: usize) {
        if self.cursor_y >= self.rows {
            return;
        }
        let row = &mut self.cells[self.cursor_y];
        for _ in 0..n {
            if self.cursor_x < row.len() {
                row.remove(self.cursor_x);
                row.push(Cell::default());
            }
        }
    }

    /// Insert characters at cursor position
    fn insert_chars(&mut self, n: usize) {
        if self.cursor_y >= self.rows {
            return;
        }
        let row = &mut self.cells[self.cursor_y];
        for _ in 0..n {
            if self.cursor_x < self.cols {
                row.insert(self.cursor_x, Cell::default());
                row.truncate(self.cols);
            }
        }
    }

    /// Convert buffer to render state
    fn to_render_state(&self, size: TerminalSize) -> TerminalRenderState {
        let mut cells = Vec::new();

        for (y, row) in self.cells.iter().enumerate() {
            for (x, cell) in row.iter().enumerate() {
                if x < self.cols {
                    cells.push(RenderCell {
                        x,
                        y,
                        c: cell.c.to_string(),
                        fg: cell.attrs.fg.to_fg_css(),
                        bg: cell.attrs.bg.to_bg_css(),
                        flags: cell.attrs.flags,
                    });
                }
            }
        }

        TerminalRenderState {
            cells,
            cursor: CursorState {
                x: self.cursor_x,
                y: self.cursor_y,
                shape: "block".to_string(),
                visible: self.cursor_visible,
            },
            size,
            selections: vec![],
        }
    }
}

impl Terminal {
    /// Spawn a new terminal
    pub fn spawn(
        shell: &str,
        working_dir: &Path,
        env: &[(String, String)],
        size: TerminalSize,
        event_tx: mpsc::UnboundedSender<TerminalEvent>,
    ) -> Result<Self> {
        let id = TerminalId::new();

        // Create PTY
        let pty = PtyHandle::spawn(shell, working_dir, env, size)?;
        let pty = Arc::new(Mutex::new(pty));

        // Create buffer
        let buffer = Arc::new(Mutex::new(TerminalBuffer::new(
            size.cols as usize,
            size.rows as usize,
        )));

        // Spawn read loop
        let pty_clone = pty.clone();
        let buffer_clone = buffer.clone();
        let event_tx_clone = event_tx.clone();
        let id_clone = id;

        tokio::spawn(async move {
            let mut reader = match pty_clone.lock().master.try_clone_reader() {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to clone PTY reader: {}", e);
                    return;
                }
            };

            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = event_tx_clone.send(TerminalEvent::Exited(id_clone, 0));
                        break;
                    }
                    Ok(n) => {
                        {
                            let mut buffer = buffer_clone.lock();
                            for byte in &buf[..n] {
                                buffer.write_byte(*byte);
                            }
                        }
                        let _ = event_tx_clone.send(TerminalEvent::Redraw(id_clone));
                    }
                    Err(e) => {
                        tracing::error!("PTY read error: {}", e);
                        break;
                    }
                }
            }
        });

        Ok(Self {
            id,
            pty,
            size,
            buffer,
            event_tx,
        })
    }

    /// Get the terminal ID
    pub fn id(&self) -> TerminalId {
        self.id
    }

    /// Write data to the terminal
    pub fn write(&self, data: &[u8]) -> Result<()> {
        let mut writer = self
            .pty
            .lock()
            .master
            .take_writer()
            .map_err(|e| Error::Pty(e.to_string()))?;
        writer.write_all(data)?;
        Ok(())
    }

    /// Resize the terminal
    pub fn resize(&mut self, size: TerminalSize) -> Result<()> {
        self.size = size;
        self.pty.lock().resize(size)?;

        let mut buffer = self.buffer.lock();
        let new_cols = size.cols as usize;
        let new_rows = size.rows as usize;

        // Resize cells grid
        buffer.cells.resize(new_rows, vec![Cell::default(); new_cols]);
        for row in &mut buffer.cells {
            row.resize(new_cols, Cell::default());
        }

        buffer.cols = new_cols;
        buffer.rows = new_rows;
        buffer.scroll_bottom = new_rows.saturating_sub(1);

        // Ensure cursor is in bounds
        buffer.cursor_x = buffer.cursor_x.min(new_cols.saturating_sub(1));
        buffer.cursor_y = buffer.cursor_y.min(new_rows.saturating_sub(1));

        Ok(())
    }

    /// Get the current render state
    pub fn get_render_state(&self) -> TerminalRenderState {
        self.buffer.lock().to_render_state(self.size)
    }
}

/// Terminal manager
pub struct TerminalManager {
    terminals: HashMap<TerminalId, Terminal>,
    event_tx: mpsc::UnboundedSender<TerminalEvent>,
    event_rx: mpsc::UnboundedReceiver<TerminalEvent>,
}

impl TerminalManager {
    pub fn new() -> Self {
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        Self {
            terminals: HashMap::new(),
            event_tx,
            event_rx,
        }
    }

    pub fn spawn(
        &mut self,
        shell: &str,
        working_dir: &Path,
        env: &[(String, String)],
        size: TerminalSize,
    ) -> Result<TerminalId> {
        let terminal = Terminal::spawn(shell, working_dir, env, size, self.event_tx.clone())?;
        let id = terminal.id();
        self.terminals.insert(id, terminal);
        Ok(id)
    }

    pub fn get(&self, id: TerminalId) -> Option<&Terminal> {
        self.terminals.get(&id)
    }

    pub fn get_mut(&mut self, id: TerminalId) -> Option<&mut Terminal> {
        self.terminals.get_mut(&id)
    }

    pub fn remove(&mut self, id: TerminalId) -> Option<Terminal> {
        self.terminals.remove(&id)
    }

    pub fn list(&self) -> Vec<TerminalId> {
        self.terminals.keys().copied().collect()
    }

    pub async fn next_event(&mut self) -> Option<TerminalEvent> {
        self.event_rx.recv().await
    }

    pub fn event_sender(&self) -> mpsc::UnboundedSender<TerminalEvent> {
        self.event_tx.clone()
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
