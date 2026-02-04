/**
 * PortablePty - Frontend service for portable-pty based terminals
 *
 * This service communicates with the Rust backend's portable-pty implementation
 * using Tauri commands and events for low-latency terminal I/O.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface PtyConfig {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PtyHandle {
  id: string;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  kill: () => Promise<void>;
  onData: (callback: (data: Uint8Array) => void) => Promise<UnlistenFn>;
  onExit: (callback: (code: number | null) => void) => Promise<UnlistenFn>;
}

interface TerminalOutputPayload {
  id: string;
  data: number[]; // Raw bytes from backend
}

interface TerminalExitPayload {
  id: string;
  code: number | null;
}

// Direct writer - no batching for lowest latency
class DirectWriter {
  private terminalId: string;

  constructor(terminalId: string) {
    this.terminalId = terminalId;
  }

  write(data: string) {
    // Send immediately without batching
    invoke('write_terminal', { id: this.terminalId, data }).catch((error) => {
      console.error('[PortablePty] Write error:', error);
    });
  }

  dispose() {
    // Nothing to flush
  }
}

/**
 * Spawn a new PTY terminal
 */
export async function spawn(
  shell?: string,
  args?: string[],
  options?: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  }
): Promise<PtyHandle> {
  // Create terminal via Tauri command
  const terminalId = await invoke<string>('create_terminal', {
    shell,
    args,
    cwd: options?.cwd,
    env: options?.env,
  });

  // If initial size provided, resize immediately
  if (options?.cols && options?.rows) {
    await invoke('resize_terminal', {
      id: terminalId,
      cols: options.cols,
      rows: options.rows,
    });
  }

  // Create direct writer for this terminal (no batching = lowest latency)
  const writer = new DirectWriter(terminalId);

  // Track event listeners for cleanup
  let dataUnlisten: UnlistenFn | null = null;
  let exitUnlisten: UnlistenFn | null = null;

  return {
    id: terminalId,

    async write(data: string) {
      writer.write(data);
    },

    async resize(cols: number, rows: number) {
      try {
        await invoke('resize_terminal', { id: terminalId, cols, rows });
      } catch (error) {
        console.error('[PortablePty] Resize error:', error);
      }
    },

    async kill() {
      writer.dispose();

      // Clean up listeners
      if (dataUnlisten) {
        dataUnlisten();
        dataUnlisten = null;
      }
      if (exitUnlisten) {
        exitUnlisten();
        exitUnlisten = null;
      }

      try {
        await invoke('close_terminal', { id: terminalId });
      } catch (error) {
        console.error('[PortablePty] Kill error:', error);
      }
    },

    async onData(callback: (data: Uint8Array) => void): Promise<UnlistenFn> {
      // Listen for terminal output events
      const unlisten = await listen<TerminalOutputPayload>(
        'terminal-output',
        (event) => {
          if (event.payload.id === terminalId) {
            // Convert number array to Uint8Array for xterm.js
            callback(new Uint8Array(event.payload.data));
          }
        }
      );

      dataUnlisten = unlisten;
      return unlisten;
    },

    async onExit(callback: (code: number | null) => void): Promise<UnlistenFn> {
      // Listen for terminal exit events
      const unlisten = await listen<TerminalExitPayload>(
        'terminal-exit',
        (event) => {
          if (event.payload.id === terminalId) {
            callback(event.payload.code);
          }
        }
      );

      exitUnlisten = unlisten;
      return unlisten;
    },
  };
}
