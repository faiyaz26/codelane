/**
 * Terminal types for lifecycle management
 */

import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { PtyHandle } from '../services/PortablePty';

/**
 * Terminal lifecycle status
 */
export type TerminalStatus = 'initializing' | 'ready' | 'error' | 'exited';

/**
 * Configuration for creating a terminal
 */
export interface TerminalConfig {
  id: string;
  cwd?: string;
  useAgent?: boolean;
  env?: Record<string, string>;
}

/**
 * Handle to an active terminal instance
 */
export interface TerminalHandle {
  id: string;
  pty: PtyHandle;
  terminal: Terminal;
  fitAddon: FitAddon;
  status: TerminalStatus;
  createdAt: number;
}

/**
 * Options for terminal pool
 */
export interface TerminalPoolOptions {
  maxConcurrent?: number;
  keepAliveInactive?: boolean;
}
