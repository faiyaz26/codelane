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
 *
 * Uses Uint8Array chunks to avoid spread operator stack overflow on large outputs.
 * Now supports multiple concurrent subscribers.
 */
class BatchedReader {
  private chunks: Uint8Array[] = [];
  private totalBytes = 0;
  private callbacks = new Set<(data: Uint8Array) => void>();
  private frameScheduled = false;
  private disposed = false;

  addCallback(callback: (data: Uint8Array) => void) {
    this.callbacks.add(callback);
  }

  removeCallback(callback: (data: Uint8Array) => void) {
    this.callbacks.delete(callback);
  }

  push(data: number[]) {
    if (this.disposed) return;

    // Store as Uint8Array chunk (avoids spread operator stack overflow on large outputs)
    const chunk = new Uint8Array(data);
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;

    // Schedule flush on next animation frame (if not already scheduled)
    if (!this.frameScheduled) {
      this.frameScheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  private flush() {
    this.frameScheduled = false;

    if (this.disposed || this.totalBytes === 0 || this.callbacks.size === 0) {
      this.chunks = [];
      this.totalBytes = 0;
      return;
    }

    // Fast path: single chunk, no copy needed
    let data: Uint8Array;
    if (this.chunks.length === 1) {
      data = this.chunks[0];
    } else {
      // Concatenate all chunks into a single Uint8Array
      data = new Uint8Array(this.totalBytes);
      let offset = 0;
      for (const chunk of this.chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    }

    this.chunks = [];
    this.totalBytes = 0;

    for (const callback of this.callbacks) {
      try {
        callback(data);
      } catch (err) {
        console.error('[PortablePty] Callback error:', err);
      }
    }
  }

  dispose() {
    this.disposed = true;
    // Flush any remaining data
    if (this.totalBytes > 0 && this.callbacks.size > 0) {
      this.flush();
    }
    this.callbacks.clear();
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
  let dataUnlistenPromise: Promise<UnlistenFn> | null = null;
  let exitUnlistenPromise: Promise<UnlistenFn> | null = null;
  const exitCallbacks = new Set<(code: number | null) => void>();

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

      // Clean up backend listeners
      if (dataUnlistenPromise) {
        const unlisten = await dataUnlistenPromise;
        unlisten();
      }
      if (exitUnlistenPromise) {
        const unlisten = await exitUnlistenPromise;
        unlisten();
      }

      try {
        await invoke('close_terminal', { id: terminalId });
      } catch (error) {
        console.error('[PortablePty] Kill error:', error);
      }
    },

    async onData(callback: (data: Uint8Array) => void): Promise<UnlistenFn> {
      // Add callback to the batched reader
      reader.addCallback(callback);

      // Lazily initialize backend listener if it's the first subscriber
      if (!dataUnlistenPromise) {
        dataUnlistenPromise = listen<TerminalOutputPayload>(
          'terminal-output',
          (event) => {
            if (event.payload.id === terminalId) {
              reader.push(event.payload.data);
            }
          }
        );
      }

      // Return a function that removes this specific callback
      return () => {
        reader.removeCallback(callback);
      };
    },

    async onExit(callback: (code: number | null) => void): Promise<UnlistenFn> {
      exitCallbacks.add(callback);

      // Lazily initialize backend listener if it's the first subscriber
      if (!exitUnlistenPromise) {
        exitUnlistenPromise = listen<TerminalExitPayload>(
          'terminal-exit',
          (event) => {
            if (event.payload.id === terminalId) {
              for (const cb of exitCallbacks) {
                try {
                  cb(event.payload.code);
                } catch (err) {
                  console.error('[PortablePty] Exit callback error:', err);
                }
              }
            }
          }
        );
      }

      // Return a function that removes this specific callback
      return () => {
        exitCallbacks.delete(callback);
      };
    },
  };
}
