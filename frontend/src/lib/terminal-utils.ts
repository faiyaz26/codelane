/**
 * Shared terminal utilities and configuration
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SearchAddon } from '@xterm/addon-search';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { getTerminalTheme } from '../theme';

/**
 * Creates a pre-configured xterm.js Terminal instance with current theme
 */
export function createTerminal(): Terminal {
  const theme = getTerminalTheme();

  return new Terminal({
    cursorBlink: false,
    cursorStyle: 'block',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    allowTransparency: false,
    theme,
    scrollback: 5000,
    convertEol: false,
    windowsMode: false,
    fastScrollModifier: 'shift',
  });
}

/**
 * Loads rendering and utility addons onto a terminal.
 * Should be called AFTER terminal.open() since WebGL/Canvas need an attached DOM.
 *
 * - WebGL renderer (GPU-accelerated) with automatic Canvas fallback
 * - Unicode11 for correct CJK/emoji width
 * - WebLinks for clickable URLs
 * - Search addon (returned for external use)
 */
export function loadAddons(terminal: Terminal): { searchAddon: SearchAddon } {
  // Unicode11 - correct character widths for CJK and emoji
  const unicode11 = new Unicode11Addon();
  terminal.loadAddon(unicode11);
  terminal.unicode.activeVersion = '11';

  // Web links - clickable URLs in terminal output, opened via Tauri shell
  terminal.loadAddon(new WebLinksAddon((_event, uri) => {
    shellOpen(uri).catch((err) => {
      console.error('[terminal] Failed to open link:', err);
    });
  }));

  // Search addon - expose for Ctrl+F terminal search
  const searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  // Canvas renderer — more reliable than WebGL for TUI apps like Claude Code
  // that do rapid cursor-addressed updates (spinners, status lines, alternate screen).
  // WebGL can produce rendering artifacts with frequent partial-screen redraws.
  try {
    terminal.loadAddon(new CanvasAddon());
  } catch {
    // Canvas not available — xterm.js DOM renderer is the final fallback
  }

  return { searchAddon };
}

/**
 * Updates a terminal's theme to match the current app theme
 */
export function updateTerminalTheme(terminal: Terminal): void {
  const theme = getTerminalTheme();
  terminal.options.theme = theme;
}

/**
 * Attaches custom key handlers to a terminal
 * - Cmd/Ctrl+C: copy selected text to clipboard (falls through to SIGINT if no selection)
 * - Cmd/Ctrl+V: paste from clipboard into PTY
 * - Shift+Enter: sends ESC + CR sequence for Claude Code compatibility
 *
 * Returns a cleanup function to remove the event listener
 */
export function attachKeyHandlers(
  terminal: Terminal,
  writeToPty: (data: string) => void
): () => void {
  // Use both xterm handler AND DOM event listener for reliability

  // Track if we've already handled this event to prevent double-firing
  let lastHandledTimestamp = 0;

  const sendShiftEnter = () => {
    const now = Date.now();
    // Debounce - only send if more than 50ms since last send
    if (now - lastHandledTimestamp > 50) {
      lastHandledTimestamp = now;
      writeToPty('\x1b\r'); // ESC + carriage return
    }
  };

  // 1. xterm.js custom key handler (catches most events)
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;

    const isMod = event.metaKey || event.ctrlKey;

    // Cmd/Ctrl+C: copy selection (if text is selected)
    if (isMod && event.key === 'c' && terminal.hasSelection()) {
      const selection = terminal.getSelection();
      if (selection) {
        writeText(selection).catch(() => {});
        terminal.clearSelection();
      }
      return false;
    }

    // Cmd/Ctrl+V: paste from clipboard
    if (isMod && event.key === 'v') {
      readText().then((text) => {
        if (text) writeToPty(text);
      }).catch(() => {});
      return false;
    }

    // Shift+Enter: Claude Code compatibility
    if (event.key === 'Enter' && event.shiftKey) {
      sendShiftEnter();
      return false;
    }

    return true;
  });

  // 2. DOM-level keydown listener on terminal element (backup for Shift+Enter)
  const terminalElement = terminal.element;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      sendShiftEnter();
    }
  };

  if (terminalElement) {
    terminalElement.addEventListener('keydown', handleKeyDown, { capture: true });
  }

  // Return cleanup function
  return () => {
    if (terminalElement) {
      terminalElement.removeEventListener('keydown', handleKeyDown, { capture: true });
    }
  };
}

/**
 * Creates a FitAddon and attaches it to the terminal
 */
export function createFitAddon(terminal: Terminal): FitAddon {
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  return fitAddon;
}
