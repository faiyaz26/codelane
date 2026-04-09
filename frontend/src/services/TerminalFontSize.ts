/**
 * TerminalFontSize - Global terminal font size with Cmd+/- zoom support
 *
 * Persists the font size in localStorage and updates all active terminals.
 */

import { createSignal } from 'solid-js';
import { terminalPool } from './TerminalPool';
import { keyboardShortcutManager } from './KeyboardShortcutManager';

const STORAGE_KEY = 'codelane-terminal-font-size';
const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const STEP = 1;

function loadFontSize(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
        return parsed;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_FONT_SIZE;
}

function saveFontSize(size: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // localStorage unavailable
  }
}

const [fontSize, setFontSizeSignal] = createSignal(loadFontSize());

function applyToAllTerminals(size: number): void {
  for (const handle of terminalPool.getAllHandles()) {
    handle.terminal.options.fontSize = size;
    try {
      handle.fitAddon.fit();
      // Resize PTY to match new cols/rows after font size change
      terminalPool.resize(handle.id, handle.terminal.cols, handle.terminal.rows).catch(() => {});
    } catch {
      // terminal may not be attached yet
    }
  }
}

export function getTerminalFontSize(): number {
  return fontSize();
}

/** Reactive signal accessor for use in SolidJS effects */
export const terminalFontSize = fontSize;

export function setTerminalFontSize(size: number): void {
  const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
  setFontSizeSignal(clamped);
  saveFontSize(clamped);
  applyToAllTerminals(clamped);
}

export function increaseTerminalFontSize(): void {
  setTerminalFontSize(fontSize() + STEP);
}

export function decreaseTerminalFontSize(): void {
  setTerminalFontSize(fontSize() - STEP);
}

export function resetTerminalFontSize(): void {
  setTerminalFontSize(DEFAULT_FONT_SIZE);
}

// Register global keyboard shortcuts for terminal zoom
keyboardShortcutManager.register({
  id: 'terminalZoomIn',
  description: 'Increase terminal font size',
  key: '=',
  modifiers: { cmdOrCtrl: true },
  handler: () => increaseTerminalFontSize(),
  scope: 'global',
});

keyboardShortcutManager.register({
  id: 'terminalZoomInPlus',
  description: 'Increase terminal font size (+)',
  key: '+',
  modifiers: { cmdOrCtrl: true },
  handler: () => increaseTerminalFontSize(),
  scope: 'global',
});

keyboardShortcutManager.register({
  id: 'terminalZoomOut',
  description: 'Decrease terminal font size',
  key: '-',
  modifiers: { cmdOrCtrl: true },
  handler: () => decreaseTerminalFontSize(),
  scope: 'global',
});

keyboardShortcutManager.register({
  id: 'terminalZoomReset',
  description: 'Reset terminal font size',
  key: '0',
  modifiers: { cmdOrCtrl: true },
  handler: () => resetTerminalFontSize(),
  scope: 'global',
});
