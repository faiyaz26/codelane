/**
 * TerminalPool - Lazy PTY lifecycle and resource management
 *
 * Manages terminal instances with lazy creation (only when needed),
 * proper cleanup, and resource limits.
 *
 * Now uses portable-pty backend with event-based output streaming
 * for significantly reduced input latency.
 */

import { spawn, type PtyHandle } from './PortablePty';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
import { createTerminal, createFitAddon, attachKeyHandlers } from '../lib/terminal-utils';
import type {
  TerminalConfig,
  TerminalHandle,
  TerminalPoolOptions,
  TerminalStatus,
} from '../types/terminal';

/**
 * Terminal pool for managing PTY instances
 */
class TerminalPool {
  private handles = new Map<string, TerminalHandle>();
  private maxConcurrent: number;
  private keepAliveInactive: boolean;

  constructor(options: TerminalPoolOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.keepAliveInactive = options.keepAliveInactive ?? false;
  }

  /**
   * Acquire a terminal handle (create if needed)
   */
  async acquire(config: TerminalConfig): Promise<TerminalHandle> {
    console.log('[TerminalPool] Acquiring terminal:', config.id);

    // Check if already exists
    const existing = this.handles.get(config.id);
    if (existing) {
      console.log('[TerminalPool] Returning existing terminal:', config.id);
      return existing;
    }

    // Check resource limits
    if (this.handles.size >= this.maxConcurrent) {
      throw new Error(
        `[TerminalPool] Max concurrent terminals reached (${this.maxConcurrent})`
      );
    }

    // Create new terminal
    const handle = await this.createTerminalHandle(config);
    this.handles.set(config.id, handle);

    console.log('[TerminalPool] Created terminal:', config.id);

    return handle;
  }

  /**
   * Release a terminal handle (cleanup PTY)
   */
  async release(terminalId: string): Promise<void> {
    console.log('[TerminalPool] Releasing terminal:', terminalId);

    const handle = this.handles.get(terminalId);
    if (!handle) {
      console.warn('[TerminalPool] Terminal not found:', terminalId);
      return;
    }

    // Kill PTY
    try {
      await handle.pty.kill();
      console.log('[TerminalPool] PTY killed:', terminalId);
    } catch (error) {
      console.error('[TerminalPool] Failed to kill PTY:', error);
    }

    // Dispose terminal
    handle.terminal.dispose();

    // Remove from pool
    this.handles.delete(terminalId);
  }

  /**
   * Resize a terminal
   */
  async resize(terminalId: string, cols: number, rows: number): Promise<void> {
    const handle = this.handles.get(terminalId);
    if (!handle) {
      console.warn('[TerminalPool] Terminal not found for resize:', terminalId);
      return;
    }

    try {
      await handle.pty.resize(cols, rows);
    } catch (error) {
      console.error('[TerminalPool] Failed to resize PTY:', error);
    }
  }

  /**
   * Get terminal handle by ID
   */
  getHandle(terminalId: string): TerminalHandle | undefined {
    return this.handles.get(terminalId);
  }

  /**
   * Cleanup all terminals
   */
  async cleanup(): Promise<void> {
    console.log('[TerminalPool] Cleaning up all terminals');

    const releasePromises = Array.from(this.handles.keys()).map((id) =>
      this.release(id)
    );

    await Promise.all(releasePromises);
  }

  /**
   * Create a new terminal instance
   */
  private async createTerminalHandle(config: TerminalConfig): Promise<TerminalHandle> {
    // Create xterm.js instance with shared configuration
    const terminal = createTerminal();
    const fitAddon = createFitAddon(terminal);

    let status: TerminalStatus = 'initializing';

    // Spawn PTY
    let spawnSuccess = false;
    const useAgent = config.useAgent !== false; // Default to true

    // Extract laneId from terminal ID (format: "laneId-tab-tabId")
    const laneId = config.id.split('-tab-')[0];

    // Merge environment
    const baseEnv: Record<string, string> = {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      CODELANE_LANE_ID: laneId,
      CODELANE_SESSION_ID: `${config.id}-${Date.now()}`,
      ...config.env,
    };

    let pty: PtyHandle | undefined;

    // Use sensible defaults since terminal isn't opened yet
    const cols = terminal.cols > 0 ? terminal.cols : 80;
    const rows = terminal.rows > 0 ? terminal.rows : 24;

    // Try agent first if enabled
    if (useAgent) {
      const agentConfig = await getLaneAgentConfig(laneId);

      if (agentConfig.agentType !== 'shell') {
        const commandPath = await checkCommandExists(agentConfig.command);

        if (commandPath) {
          try {
            pty = await spawn(commandPath, agentConfig.args, {
              cols,
              rows,
              cwd: agentConfig.useLaneCwd ? config.cwd : undefined,
              env: { ...baseEnv, ...agentConfig.env },
            });
            spawnSuccess = true;
            console.log('[TerminalPool] Agent spawned:', commandPath);
          } catch (error) {
            console.error('[TerminalPool] Failed to spawn agent:', error);
          }
        }
      }
    }

    // Fallback to shell
    if (!spawnSuccess) {
      const fallbackShell = 'zsh';
      try {
        pty = await spawn(fallbackShell, undefined, {
          cols,
          rows,
          cwd: config.cwd,
          env: baseEnv,
        });
        console.log('[TerminalPool] Shell spawned:', fallbackShell);
      } catch (error) {
        console.error('[TerminalPool] Failed to spawn shell:', error);
        throw error;
      }
    }

    // Ensure pty was created
    if (!pty) {
      const error = '[TerminalPool] Failed to create PTY - pty is undefined';
      console.error(error);
      throw new Error(error);
    }

    status = 'ready';

    // Attach custom key handlers (Shift+Enter, etc.)
    attachKeyHandlers(terminal, (data) => pty!.write(data));

    // Set up event-based data flow (low latency!)
    // PTY output → terminal
    await pty.onData((data) => {
      terminal.write(data);
    });

    // Terminal input → PTY
    terminal.onData((data) => {
      pty!.write(data);
    });

    // Handle PTY exit
    await pty.onExit(() => {
      console.log('[TerminalPool] PTY exited:', config.id);
      terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
      status = 'exited';
    });

    return {
      id: config.id,
      pty,
      terminal,
      fitAddon,
      status,
      createdAt: Date.now(),
    };
  }
}

// Export singleton instance
export const terminalPool = new TerminalPool({ maxConcurrent: 10 });
