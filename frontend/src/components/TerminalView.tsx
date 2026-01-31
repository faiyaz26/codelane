import { onCleanup, onMount } from 'solid-js';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { spawn, type PtyHandle } from '../services/PortablePty';
import { ZED_THEME } from '../theme';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
import { createTerminal, createFitAddon, attachKeyHandlers } from '../lib/terminal-utils';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  laneId: string;
  cwd?: string;
  useAgent?: boolean; // If false, use plain shell instead of agent
  onTerminalReady?: (terminalId: string) => void;
  onTerminalExit?: () => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

export function TerminalView(props: TerminalViewProps) {
  console.log('[TerminalView] Created with laneId:', props.laneId);

  let containerRef: HTMLDivElement | undefined;
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let pty: PtyHandle | undefined;

  onMount(async () => {
    console.log('[TerminalView] Mounting laneId:', props.laneId);
    if (!containerRef) return;

    // Create xterm.js instance with shared configuration
    terminal = createTerminal();
    fitAddon = createFitAddon(terminal);

    // Open terminal in the container
    terminal.open(containerRef);

    // Fit terminal to container
    fitAddon.fit();

    // Focus the terminal
    terminal.focus();

    try {
      let spawnSuccess = false;
      const useAgent = props.useAgent !== false; // Default to true

      // Base environment
      const baseEnv: Record<string, string> = {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CODELANE_LANE_ID: props.laneId,
        CODELANE_SESSION_ID: `${props.laneId}-${Date.now()}`,
      };

      // Load agent config only if useAgent is true
      if (useAgent) {
        const agentConfig = await getLaneAgentConfig(props.laneId);

        console.log('Agent config:', JSON.stringify(agentConfig, null, 2));

        // Merge agent env with terminal env
        const env = {
          ...baseEnv,
          ...agentConfig.env,
        };

        // Try to spawn the configured agent
        if (agentConfig.agentType !== 'shell') {
          console.log('Checking if agent exists:', agentConfig.command);

          // Check if command exists before trying to spawn
          const commandPath = await checkCommandExists(agentConfig.command);

          if (commandPath) {
            console.log('Agent found at:', commandPath);
            console.log('Spawning agent:', commandPath);

            try {
              pty = await spawn(commandPath, agentConfig.args, {
                cols: terminal.cols,
                rows: terminal.rows,
                cwd: agentConfig.useLaneCwd ? props.cwd : undefined,
                env,
              });

              spawnSuccess = true;
              console.log('Agent spawned successfully, terminal ID:', pty.id);
            } catch (spawnError) {
              console.error('Failed to spawn agent:', spawnError);
              spawnSuccess = false;
              // Notify parent that agent failed
              props.onAgentFailed?.(agentConfig.agentType, agentConfig.command);
            }
          } else {
            console.log('Agent command not found in PATH:', agentConfig.command);
            spawnSuccess = false;
            // Notify parent that agent is not installed
            props.onAgentFailed?.(agentConfig.agentType, agentConfig.command);
          }
        }
      }

      // Fallback to shell if agent failed, agent type is shell, or useAgent is false
      if (!spawnSuccess) {
        // Use zsh as default shell (will use user's default shell via -l flag)
        const fallbackShell = 'zsh';
        console.log('Using shell:', fallbackShell);

        pty = await spawn(fallbackShell, undefined, {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: props.cwd,
          env: baseEnv,
        });

        console.log('Shell spawned, terminal ID:', pty.id);
      }

      // Attach custom key handlers (Shift+Enter, etc.)
      attachKeyHandlers(terminal, (data) => pty!.write(data));

      // Set up event-based data flow (low latency!)
      // PTY output → terminal
      await pty!.onData((data) => {
        if (terminal) {
          terminal.write(data);
        }
      });

      // Terminal input → PTY
      terminal.onData((data) => {
        if (pty) {
          pty.write(data);
        }
      });

      // Handle PTY exit
      await pty!.onExit(() => {
        console.log('PTY exited');
        if (terminal) {
          terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
        }
        props.onTerminalExit?.();
      });

      // Call ready callback with terminal ID
      props.onTerminalReady?.(pty!.id);

      // Handle resize events with debouncing
      let resizeTimeout: number | undefined;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          if (fitAddon && terminal && pty) {
            fitAddon.fit();
            pty.resize(terminal.cols, terminal.rows);
          }
        }, 100) as unknown as number;
      });

      if (containerRef) {
        resizeObserver.observe(containerRef);
      }

      // Initial resize
      setTimeout(() => {
        if (fitAddon && terminal && pty) {
          fitAddon.fit();
          pty.resize(terminal.cols, terminal.rows);
          // Scroll to bottom after a brief delay to ensure terminal has updated
          setTimeout(() => terminal.scrollToBottom(), 50);
        }
      }, 100);

      // Listen for custom terminal resize events
      const handleTerminalResize = () => {
        if (fitAddon && terminal && pty) {
          fitAddon.fit();
          pty.resize(terminal.cols, terminal.rows);
        }
      };
      window.addEventListener('terminal-resize', handleTerminalResize);

      // Cleanup
      onCleanup(() => {
        resizeObserver.disconnect();
        window.removeEventListener('terminal-resize', handleTerminalResize);
      });
    } catch (error) {
      console.error('Failed to create PTY:', error);
      if (terminal) {
        terminal.write('\r\n\x1b[1;31mFailed to create terminal:\x1b[0m ' + error + '\r\n');
      }
    }
  });

  // Cleanup on unmount
  onCleanup(async () => {
    console.log('[TerminalView] Cleanup for laneId:', props.laneId);
    if (pty) {
      try {
        await pty.kill();
        console.log('PTY killed');
      } catch (error) {
        console.error('Failed to kill PTY:', error);
      }
    }

    if (terminal) {
      terminal.dispose();
    }
  });

  return (
    <div
      ref={containerRef}
      class="w-full h-full"
      style={{
        background: ZED_THEME.bg.panel,
      }}
    />
  );
}
