/**
 * Shared terminal utilities and configuration
 */

import { Terminal, type ILinkProvider, type ILink } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SearchAddon } from '@xterm/addon-search';
import { getTerminalTheme } from '../theme/theme';

export interface TerminalHandlers {
  onOpenLink?: (uri: string) => void;
  onOpenFile?: (path: string, line?: number, column?: number) => void;
  onWriteClipboard?: (text: string) => Promise<void>;
}

// Matches Unix absolute paths (/foo/bar) and home-relative paths (~/foo/bar),
// optionally suffixed with :line or :line:col. Excludes URLs (// prefix handled
// by WebLinksAddon) and common shell non-path patterns.
const FILE_PATH_REGEX =
  /((?:~\/|\/(?!\/))[\w.\-/][\w.\-/ ]*?\.[a-zA-Z0-9]{1,15})(:\d+)?(:\d+)?(?=[^\w.\-/]|$)/g;

class FilePathLinkProvider implements ILinkProvider {
  constructor(
    private readonly terminal: Terminal,
    private readonly onOpenFile: NonNullable<TerminalHandlers['onOpenFile']>
  ) {}

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const line = this.terminal.buffer.active.getLine(bufferLineNumber - 1);
    if (!line) {
      callback(undefined);
      return;
    }

    // Use the full line string; positions stay accurate since we don't trim.
    const lineText = line.translateToString(false);

    FILE_PATH_REGEX.lastIndex = 0;
    const links: ILink[] = [];
    let match: RegExpExecArray | null;

    while ((match = FILE_PATH_REGEX.exec(lineText)) !== null) {
      const fullMatch = match[0];
      const filePath = match[1];
      const lineStr = match[2]; // ":42" or undefined
      const colStr = match[3];  // ":5" or undefined

      // Skip matches that look like they're part of a URL (e.g. after "://")
      const before = lineText.slice(0, match.index);
      if (before.endsWith(':') || before.endsWith('//')) continue;

      const lineNum = lineStr ? parseInt(lineStr.slice(1), 10) - 1 : undefined;
      const colNum = colStr ? parseInt(colStr.slice(1), 10) - 1 : undefined;

      const startX = match.index + 1; // IBufferCellPosition x is 1-based
      const endX = match.index + fullMatch.length;

      const handler = this.onOpenFile;
      const capturedPath = filePath;
      const capturedLine = lineNum;
      const capturedCol = colNum;

      links.push({
        range: {
          start: { x: startX, y: bufferLineNumber },
          end: { x: endX, y: bufferLineNumber },
        },
        text: fullMatch,
        decorations: { pointerCursor: true, underline: true },
        activate(_event: MouseEvent, _text: string) {
          handler(capturedPath, capturedLine, capturedCol);
        },
      });
    }

    callback(links.length > 0 ? links : undefined);
  }
}

export function isTerminalViewportAtBottom(
  terminal: Pick<Terminal, 'buffer'>,
  viewportY = terminal.buffer.active.viewportY
): boolean {
  const buffer = terminal.buffer.active;
  return viewportY >= buffer.baseY;
}

/**
 * Creates a pre-configured xterm.js Terminal instance with current theme
 */
export function createTerminal(theme?: any, fontSize: number = 13): Terminal {
  return new Terminal({
    cursorBlink: false,
    cursorStyle: 'block',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize,
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
export function loadAddons(terminal: Terminal | null | undefined, handlers?: TerminalHandlers): { searchAddon: SearchAddon } {
  if (!terminal) {
    return { searchAddon: new SearchAddon() };
  }

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
  try {
    terminal.loadAddon(searchAddon);
  } catch (err) {
    console.warn('[terminal] Search addon failed to load:', err);
  }

  // File path links — clickable file paths in agent/shell output
  if (handlers?.onOpenFile) {
    try {
      terminal.registerLinkProvider(new FilePathLinkProvider(terminal, handlers.onOpenFile));
    } catch (err) {
      console.warn('[terminal] FilePathLinkProvider failed to register:', err);
    }
  }

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
export function updateTerminalTheme(terminal: Terminal | null | undefined): void {
  if (!terminal?.options) return;
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

    // Cmd/Ctrl+= / Cmd/Ctrl+- / Cmd/Ctrl+0: terminal zoom (handled by KeyboardShortcutManager)
    if (isMod && (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '0')) {
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
