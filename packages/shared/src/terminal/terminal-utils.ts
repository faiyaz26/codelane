/**
 * Shared terminal utilities and configuration
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SearchAddon } from '@xterm/addon-search';
import { getTerminalTheme } from '../theme/theme';

export interface TerminalHandlers {
  onOpenLink?: (uri: string) => void;
  onWriteClipboard?: (text: string) => Promise<void>;
}

/**
 * Creates a pre-configured xterm.js Terminal instance with current theme
 */
export function createTerminal(theme: any): Terminal {
  return new Terminal({
    cursorBlink: false,
    cursorStyle: 'block',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.4,
    allowProposedApi: true, // Required for Unicode11 addon
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
 */
export function loadAddons(terminal: Terminal, handlers?: TerminalHandlers): { searchAddon: SearchAddon } {
  // Unicode11 - correct character widths for CJK and emoji
  try {
    const unicode11 = new Unicode11Addon();
    terminal.loadAddon(unicode11);
    terminal.unicode.activeVersion = '11';
  } catch (err) {
    console.warn('[terminal] Unicode11 addon failed to load:', err);
  }

  // Web links - clickable URLs in terminal output
  try {
    terminal.loadAddon(new WebLinksAddon((_event, uri) => {
      if (handlers?.onOpenLink) {
        handlers.onOpenLink(uri);
      } else {
        window.open(uri, '_blank');
      }
    }));
  } catch (err) {
    console.warn('[terminal] WebLinks addon failed to load:', err);
  }

  // Search addon - expose for Ctrl+F terminal search
  const searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  // Canvas renderer — more reliable than WebGL for TUI apps
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
 */
export function attachKeyHandlers(
  terminal: Terminal,
  writeToPty: (data: string) => void,
  handlers?: TerminalHandlers
): () => void {
  let lastHandledTimestamp = 0;

  const sendShiftEnter = () => {
    const now = Date.now();
    if (now - lastHandledTimestamp > 50) {
      lastHandledTimestamp = now;
      writeToPty('\x1b\r'); // ESC + carriage return
    }
  };

  // 1. xterm.js custom key handler
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;

    const isMod = event.metaKey || event.ctrlKey;

    // Cmd/Ctrl+C: copy selection (if text is selected)
    if (isMod && event.key === 'c' && terminal.hasSelection()) {
      const selection = terminal.getSelection();
      if (selection) {
        if (handlers?.onWriteClipboard) {
          handlers.onWriteClipboard(selection).catch(() => {});
        } else {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
        terminal.clearSelection();
      }
      return false;
    }

    // Shift+Enter: Claude Code compatibility
    if (event.key === 'Enter' && event.shiftKey) {
      sendShiftEnter();
      return false;
    }

    return true;
  });

  // 2. DOM-level keydown listener
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
