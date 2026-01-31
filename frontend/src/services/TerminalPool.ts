/**
 * TerminalPool - Lazy PTY lifecycle and resource management
 *
 * Manages terminal instances with lazy creation (only when needed),
 * proper cleanup, and resource limits.
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { spawn } from 'tauri-pty';
import { ZED_THEME } from '../theme';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
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
    const handle = await this.createTerminal(config);
    this.handles.set(config.id, handle);

    console.log('[TerminalPool] Created terminal:', config.id, 'pid:', handle.pid);

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
  private async createTerminal(config: TerminalConfig): Promise<TerminalHandle> {
    // Create xterm.js instance
    const terminal = new Terminal({
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

    // Add FitAddon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    let status: TerminalStatus = 'initializing';

    // Spawn PTY
    let spawnSuccess = false;
    const useAgent = config.useAgent !== false; // Default to true

    // Extract laneId from terminal ID (format: "laneId-tab-tabId")
    const laneId = config.id.split('-tab-')[0];

    // Merge environment
    const baseEnv = {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      CODELANE_LANE_ID: laneId,
      CODELANE_SESSION_ID: `${config.id}-${Date.now()}`,
      ...config.env,
    };

    let pty: Awaited<ReturnType<typeof spawn>> | undefined;

    // Try agent first if enabled
    if (useAgent) {
      const agentConfig = await getLaneAgentConfig(laneId);

      if (agentConfig.agentType !== 'shell') {
        const commandPath = await checkCommandExists(agentConfig.command);

        if (commandPath) {
          try {
            // Use sensible defaults since terminal isn't opened yet
            const cols = terminal.cols > 0 ? terminal.cols : 80;
            const rows = terminal.rows > 0 ? terminal.rows : 24;

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
        // Use sensible defaults since terminal isn't opened yet
        const cols = terminal.cols > 0 ? terminal.cols : 80;
        const rows = terminal.rows > 0 ? terminal.rows : 24;

        pty = await spawn(fallbackShell, ['-l', '-i'], {
          cols,
          rows,
          cwd: config.cwd,
          env: {
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        });
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

    // Wait for PTY initialization if needed
    if ('_init' in pty && pty._init instanceof Promise) {
      await pty._init;
    }

    status = 'ready';

    // Local echo experiment - track what we've echoed locally
    let localEchoBuffer = '';
    let echoTimeout: number | undefined;

    // Bidirectional data flow with local echo
    pty.onData((data) => {
      // Check if this is echoing back what we typed
      if (localEchoBuffer.length > 0) {
        // Simple check: if PTY data starts with our buffer, it's the echo
        if (data.startsWith(localEchoBuffer)) {
          // Skip the echoed part, only show the rest
          const remaining = data.slice(localEchoBuffer.length);
          localEchoBuffer = '';
          if (echoTimeout) clearTimeout(echoTimeout);

          if (remaining) {
            terminal.write(remaining);
          }
          return;
        } else {
          // Different data (maybe password prompt or control chars)
          // Clear buffer and show everything
          localEchoBuffer = '';
          if (echoTimeout) clearTimeout(echoTimeout);
        }
      }

      terminal.write(data);
    });

    terminal.onData((data) => {
      // Check if this is a printable character (not control char)
      const isPrintable = data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127;

      if (isPrintable) {
        // Local echo immediately for better responsiveness
        terminal.write(data);
        localEchoBuffer += data;

        // Clear buffer after 200ms if no echo comes back (e.g., password input)
        if (echoTimeout) clearTimeout(echoTimeout);
        echoTimeout = setTimeout(() => {
          localEchoBuffer = '';
        }, 200) as unknown as number;
      }

      // Always send to PTY
      pty.write(data);
    });

    // Handle PTY exit
    pty.onExit(() => {
      console.log('[TerminalPool] PTY exited:', config.id);
      terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
      status = 'exited';
    });

    return {
      id: config.id,
      pid: pty.pid,
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
