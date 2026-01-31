/**
 * Shared terminal utilities and configuration
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ZED_THEME } from '../theme';

/**
 * Creates a pre-configured xterm.js Terminal instance with Zed theme
 */
export function createTerminal(): Terminal {
  return new Terminal({
    cursorBlink: false,
    cursorStyle: 'block',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    allowTransparency: false,
    theme: {
      background: ZED_THEME.bg.panel,
      foreground: ZED_THEME.text.primary,
      cursor: ZED_THEME.accent.blue,
      cursorAccent: ZED_THEME.bg.panel,
      selectionBackground: ZED_THEME.bg.active,
      selectionForeground: ZED_THEME.text.primary,

      // ANSI colors (normal)
      black: ZED_THEME.terminal.black,
      red: ZED_THEME.terminal.red,
      green: ZED_THEME.terminal.green,
      yellow: ZED_THEME.terminal.yellow,
      blue: ZED_THEME.terminal.blue,
      magenta: ZED_THEME.terminal.magenta,
      cyan: ZED_THEME.terminal.cyan,
      white: ZED_THEME.terminal.white,

      // ANSI colors (bright)
      brightBlack: ZED_THEME.terminal.brightBlack,
      brightRed: ZED_THEME.terminal.brightRed,
      brightGreen: ZED_THEME.terminal.brightGreen,
      brightYellow: ZED_THEME.terminal.brightYellow,
      brightBlue: ZED_THEME.terminal.brightBlue,
      brightMagenta: ZED_THEME.terminal.brightMagenta,
      brightCyan: ZED_THEME.terminal.brightCyan,
      brightWhite: ZED_THEME.terminal.brightWhite,
    },
    scrollback: 5000,
    convertEol: false,
    windowsMode: false,
    fastScrollModifier: 'shift',
  });
}

/**
 * Attaches custom key handlers to a terminal
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

  const sendShiftEnter = (source: string) => {
    const now = Date.now();
    // Debounce - only send if more than 50ms since last send
    if (now - lastHandledTimestamp > 50) {
      console.log(`[terminal-utils] Shift+Enter handled by ${source}`);
      lastHandledTimestamp = now;
      writeToPty('\x1b\r'); // ESC + carriage return
    }
  };

  // 1. xterm.js custom key handler (catches most events)
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.key === 'Enter' && event.shiftKey && event.type === 'keydown') {
      sendShiftEnter('xterm');
      return false; // Prevent default handling
    }
    return true;
  });

  // 2. DOM-level keydown listener on terminal element (backup)
  const terminalElement = terminal.element;
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      sendShiftEnter('DOM');
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
