//! Terminal render state for WebView display

use serde::{Deserialize, Serialize};

use crate::TerminalSize;

/// Standard 16-color terminal palette (ANSI colors)
pub const ANSI_COLORS_16: [&str; 16] = [
    "#000000", // 0: Black
    "#cd0000", // 1: Red
    "#00cd00", // 2: Green
    "#cdcd00", // 3: Yellow
    "#0000ee", // 4: Blue
    "#cd00cd", // 5: Magenta
    "#00cdcd", // 6: Cyan
    "#e5e5e5", // 7: White
    "#7f7f7f", // 8: Bright Black (Gray)
    "#ff0000", // 9: Bright Red
    "#00ff00", // 10: Bright Green
    "#ffff00", // 11: Bright Yellow
    "#5c5cff", // 12: Bright Blue
    "#ff00ff", // 13: Bright Magenta
    "#00ffff", // 14: Bright Cyan
    "#ffffff", // 15: Bright White
];

/// Default foreground color
pub const DEFAULT_FG: &str = "#d4d4d4";

/// Default background color
pub const DEFAULT_BG: &str = "transparent";

/// Terminal color - can be default, indexed, or RGB
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TerminalColor {
    /// Default color (foreground or background)
    Default,
    /// Indexed color (0-255)
    Indexed(u8),
    /// RGB color
    Rgb(u8, u8, u8),
}

impl Default for TerminalColor {
    fn default() -> Self {
        Self::Default
    }
}

impl TerminalColor {
    /// Convert to CSS color string for foreground
    pub fn to_fg_css(&self) -> String {
        match self {
            TerminalColor::Default => DEFAULT_FG.to_string(),
            TerminalColor::Indexed(idx) => index_to_css(*idx),
            TerminalColor::Rgb(r, g, b) => format!("#{:02x}{:02x}{:02x}", r, g, b),
        }
    }

    /// Convert to CSS color string for background
    pub fn to_bg_css(&self) -> String {
        match self {
            TerminalColor::Default => DEFAULT_BG.to_string(),
            TerminalColor::Indexed(idx) => index_to_css(*idx),
            TerminalColor::Rgb(r, g, b) => format!("#{:02x}{:02x}{:02x}", r, g, b),
        }
    }
}

/// Convert a 256-color index to CSS color
pub fn index_to_css(idx: u8) -> String {
    match idx {
        // Standard 16 colors
        0..=15 => ANSI_COLORS_16[idx as usize].to_string(),
        // 216 color cube (6x6x6)
        16..=231 => {
            let idx = idx - 16;
            let r = (idx / 36) % 6;
            let g = (idx / 6) % 6;
            let b = idx % 6;
            // Convert 0-5 range to 0-255
            let r = if r == 0 { 0 } else { 55 + r * 40 };
            let g = if g == 0 { 0 } else { 55 + g * 40 };
            let b = if b == 0 { 0 } else { 55 + b * 40 };
            format!("#{:02x}{:02x}{:02x}", r, g, b)
        }
        // Grayscale (24 shades)
        232..=255 => {
            let gray = 8 + (idx - 232) * 10;
            format!("#{:02x}{:02x}{:02x}", gray, gray, gray)
        }
    }
}

/// Complete render state for the terminal
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TerminalRenderState {
    /// All visible cells
    pub cells: Vec<RenderCell>,

    /// Cursor state
    pub cursor: CursorState,

    /// Terminal size
    pub size: TerminalSize,

    /// Selection ranges (if any)
    #[serde(default)]
    pub selections: Vec<SelectionRange>,
}

/// A single cell to render
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RenderCell {
    /// Column position (0-indexed)
    pub x: usize,

    /// Row position (0-indexed)
    pub y: usize,

    /// Character to display
    pub c: String,

    /// Foreground color as CSS color string
    pub fg: String,

    /// Background color as CSS color string
    pub bg: String,

    /// Cell flags (bold, italic, underline, etc.)
    pub flags: u16,
}

/// Cursor state
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CursorState {
    /// Column position
    pub x: usize,

    /// Row position
    pub y: usize,

    /// Cursor shape: "block", "underline", or "beam"
    pub shape: String,

    /// Whether the cursor is visible
    pub visible: bool,
}

/// Selection range
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_x: usize,
    pub start_y: usize,
    pub end_x: usize,
    pub end_y: usize,
}

/// Cell flags
pub mod flags {
    pub const BOLD: u16 = 1 << 0;
    pub const ITALIC: u16 = 1 << 1;
    pub const UNDERLINE: u16 = 1 << 2;
    pub const STRIKETHROUGH: u16 = 1 << 3;
    pub const DIM: u16 = 1 << 4;
    pub const INVERSE: u16 = 1 << 5;
    pub const HIDDEN: u16 = 1 << 6;
    pub const BLINK: u16 = 1 << 7;
}

/// Cell attributes for styling
#[derive(Debug, Clone, Copy, Default)]
pub struct CellAttributes {
    pub fg: TerminalColor,
    pub bg: TerminalColor,
    pub flags: u16,
}

impl CellAttributes {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    pub fn set_bold(&mut self, on: bool) {
        if on {
            self.flags |= flags::BOLD;
        } else {
            self.flags &= !flags::BOLD;
        }
    }

    pub fn set_dim(&mut self, on: bool) {
        if on {
            self.flags |= flags::DIM;
        } else {
            self.flags &= !flags::DIM;
        }
    }

    pub fn set_italic(&mut self, on: bool) {
        if on {
            self.flags |= flags::ITALIC;
        } else {
            self.flags &= !flags::ITALIC;
        }
    }

    pub fn set_underline(&mut self, on: bool) {
        if on {
            self.flags |= flags::UNDERLINE;
        } else {
            self.flags &= !flags::UNDERLINE;
        }
    }

    pub fn set_blink(&mut self, on: bool) {
        if on {
            self.flags |= flags::BLINK;
        } else {
            self.flags &= !flags::BLINK;
        }
    }

    pub fn set_inverse(&mut self, on: bool) {
        if on {
            self.flags |= flags::INVERSE;
        } else {
            self.flags &= !flags::INVERSE;
        }
    }

    pub fn set_hidden(&mut self, on: bool) {
        if on {
            self.flags |= flags::HIDDEN;
        } else {
            self.flags &= !flags::HIDDEN;
        }
    }

    pub fn set_strikethrough(&mut self, on: bool) {
        if on {
            self.flags |= flags::STRIKETHROUGH;
        } else {
            self.flags &= !flags::STRIKETHROUGH;
        }
    }
}
