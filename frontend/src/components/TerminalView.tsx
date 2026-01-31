import { createEffect, onCleanup, onMount } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { spawn, type Pty } from 'tauri-pty';
import { ZED_THEME } from '../theme';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
import type { AgentConfig } from '../types/agent';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  laneId: string;
  cwd?: string;
  useAgent?: boolean; // If false, use plain shell instead of agent
  onTerminalReady?: (pid: number) => void;
  onTerminalExit?: () => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

export function TerminalView(props: TerminalViewProps) {
  console.log('[TerminalView] Created with laneId:', props.laneId);

  let containerRef: HTMLDivElement | undefined;
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let pty: Pty | undefined;

  onMount(async () => {
    console.log('[TerminalView] Mounting laneId:', props.laneId);
    if (!containerRef) return;

    // Create xterm.js instance with Zed theme
    terminal = new Terminal({
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

    // Add FitAddon for auto-sizing
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal in the container
    terminal.open(containerRef);

    // Fit terminal to container
    fitAddon.fit();

    // Focus the terminal
    terminal.focus();

    try {
      let spawnSuccess = false;
      const useAgent = props.useAgent !== false; // Default to true

      // Load agent config only if useAgent is true
      if (useAgent) {
        let agentConfig = await getLaneAgentConfig(props.laneId);

        console.log('Agent config:', JSON.stringify(agentConfig, null, 2));

        // Merge agent env with terminal env and add unique identifier
        const env = {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          CODELANE_LANE_ID: props.laneId,
          CODELANE_SESSION_ID: `${props.laneId}-${Date.now()}`,
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
            console.log('Agent spawned successfully');
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

        pty = await spawn(fallbackShell, ['-l', '-i'], {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: props.cwd,
          env: {
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        });

        console.log('Shell spawned with PID:', pty.pid);
      }

      // Bidirectional data flow with output buffering for better performance
      let outputBuffer = '';
      let writeScheduled = false;

      pty.onData((data) => {
        if (!terminal) return;

        // Buffer the data
        outputBuffer += data;

        // Schedule a write if not already scheduled
        if (!writeScheduled) {
          writeScheduled = true;
          requestAnimationFrame(() => {
            if (terminal && outputBuffer) {
              terminal.write(outputBuffer);
              outputBuffer = '';
            }
            writeScheduled = false;
          });
        }
      });

      terminal.onData((data) => {
        if (pty) {
          pty.write(data);
        }
      });

      // Handle PTY exit
      pty.onExit(() => {
        console.log('PTY exited');
        if (terminal) {
          terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
        }
        props.onTerminalExit?.();
      });

      // Call ready callback with actual PID
      props.onTerminalReady?.(pty.pid);

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
