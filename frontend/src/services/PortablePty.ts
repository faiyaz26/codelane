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

// Direct writer - no batching for lowest latency on input
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
 * BatchedReader - Buffers terminal output and flushes once per animation frame
 *
 * This prevents frame drops during heavy terminal output (e.g., large git logs,
 * build output). Data is collected and flushed at most ~60 times per second.
 */
class BatchedReader {
  private buffer: number[] = [];
  private callback: ((data: Uint8Array) => void) | null = null;
  private frameScheduled = false;
  private disposed = false;

  setCallback(callback: (data: Uint8Array) => void) {
    this.callback = callback;
  }

  push(data: number[]) {
    if (this.disposed) return;

    // Append to buffer
    this.buffer.push(...data);

    // Schedule flush on next animation frame (if not already scheduled)
    if (!this.frameScheduled) {
      this.frameScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  private flush() {
    this.frameScheduled = false;

    if (this.disposed || this.buffer.length === 0 || !this.callback) {
      return;
    }

    // Convert buffered data to Uint8Array and send to callback
    const data = new Uint8Array(this.buffer);
    this.buffer = [];

    try {
      this.callback(data);
    } catch (err) {
      console.error('[PortablePty] Callback error:', err);
    }
  }

  dispose() {
    this.disposed = true;
    // Flush any remaining data
    if (this.buffer.length > 0 && this.callback) {
      const data = new Uint8Array(this.buffer);
      this.buffer = [];
      try {
        this.callback(data);
      } catch {
        // Ignore errors during dispose
      }
    }
    this.callback = null;
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

  // Create direct writer for this terminal (no batching = lowest latency on input)
  const writer = new DirectWriter(terminalId);

  // Create batched reader for output (batches to prevent frame drops)
  const reader = new BatchedReader();

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
      reader.dispose();

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
      // Set callback on the batched reader
      reader.setCallback(callback);

      // Listen for terminal output events - data goes through batched reader
      const unlisten = await listen<TerminalOutputPayload>(
        'terminal-output',
        (event) => {
          if (event.payload.id === terminalId) {
            // Push to batched reader - will be flushed on next animation frame
            reader.push(event.payload.data);
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
