/**
 * Shared terminal utilities and configuration
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
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
 * Updates a terminal's theme to match the current app theme
 */
export function updateTerminalTheme(terminal: Terminal): void {
  const theme = getTerminalTheme();
  terminal.options.theme = theme;
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
