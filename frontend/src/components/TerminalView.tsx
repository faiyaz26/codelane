import { onCleanup, onMount, createEffect, createSignal, Show } from 'solid-js';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { spawn, type PtyHandle } from '../services/PortablePty';
import { getTerminalTheme } from '../theme';
import { themeManager } from '../services/ThemeManager';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
import { createTerminal, createFitAddon, attachKeyHandlers, updateTerminalTheme } from '../lib/terminal-utils';
import { agentStatusManager } from '../services/AgentStatusManager';
import type { DetectableAgentType } from '../types/agentStatus';
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
  let containerRef: HTMLDivElement | undefined;
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let pty: PtyHandle | undefined;

  const [showNotificationPrompt, setShowNotificationPrompt] = createSignal(false);
  let isAgentLane = false;

  // Watch for theme changes and update terminal
  createEffect(() => {
    const currentTheme = themeManager.getTheme()(); // Subscribe to theme changes
    if (terminal) {
      updateTerminalTheme(terminal);
    }
  });

  onMount(async () => {
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
      let agentConfig: Awaited<ReturnType<typeof getLaneAgentConfig>> | null = null;

      // Base environment
      const baseEnv: Record<string, string> = {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CODELANE_LANE_ID: props.laneId,
        CODELANE_SESSION_ID: `${props.laneId}-${Date.now()}`,
      };

      // Load agent config only if useAgent is true
      if (useAgent) {
        agentConfig = await getLaneAgentConfig(props.laneId);

        // Merge agent env with terminal env
        const env = {
          ...baseEnv,
          ...agentConfig.env,
        };

        // Try to spawn the configured agent
        if (agentConfig.agentType !== 'shell') {
          // Check if command exists before trying to spawn
          const commandPath = await checkCommandExists(agentConfig.command);

          if (commandPath) {
            try {
              pty = await spawn(commandPath, agentConfig.args, {
                cols: terminal.cols,
                rows: terminal.rows,
                cwd: agentConfig.useLaneCwd ? props.cwd : undefined,
                env,
              });

              spawnSuccess = true;
            } catch (spawnError) {
              console.error('Failed to spawn agent:', spawnError);
              spawnSuccess = false;
              // Notify parent that agent failed
              props.onAgentFailed?.(agentConfig.agentType, agentConfig.command);
            }
          } else {
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

        pty = await spawn(fallbackShell, undefined, {
          cols: terminal.cols,
          rows: terminal.rows,
          cwd: props.cwd,
          env: baseEnv,
        });
      }

      // Track resolved agent type for status detection
      const resolvedAgentType: DetectableAgentType = (spawnSuccess && useAgent)
        ? (agentConfig?.agentType || 'shell') as DetectableAgentType
        : 'shell';
      agentStatusManager.registerLane(props.laneId, resolvedAgentType);
      isAgentLane = resolvedAgentType !== 'shell';

      // Show notification prompt when agent first starts working
      if (isAgentLane) {
        const unsub = agentStatusManager.onStatusChange((change) => {
          if (
            change.laneId === props.laneId &&
            change.newStatus === 'working' &&
            agentStatusManager.shouldShowNotificationPrompt()
          ) {
            setShowNotificationPrompt(true);
            unsub();
          }
        });
        onCleanup(unsub);
      }

      // Attach custom key handlers (Shift+Enter, etc.)
      attachKeyHandlers(terminal, (data) => pty!.write(data));

      // Set up event-based data flow (low latency!)
      // PTY output → terminal
      await pty!.onData((data) => {
        if (terminal) {
          terminal.write(data);
        }
        // Feed output to agent status detector
        agentStatusManager.feedOutput(props.laneId, data);
      });

      // Terminal input → PTY
      terminal.onData((data) => {
        if (pty) {
          pty.write(data);
        }
        // Signal user input to agent status detector (transitions out of waiting_for_input)
        agentStatusManager.feedUserInput(props.laneId, data);
      });

      // Handle PTY exit
      await pty!.onExit(() => {
        if (terminal) {
          terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
        }
        props.onTerminalExit?.();
        agentStatusManager.markExited(props.laneId);
      });

      // Periodic buffer sampling for prompt detection (250ms interval)
      // This catches prompts that might be missed by chunk-based detection
      const bufferCheckInterval = setInterval(() => {
        if (!terminal) return;

        // Read last 20 lines from terminal buffer
        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        const startLine = Math.max(0, buffer.baseY + buffer.cursorY - 20);
        const endLine = buffer.baseY + buffer.cursorY;

        for (let i = startLine; i <= endLine; i++) {
          const line = buffer.getLine(i);
          if (line) {
            lines.push(line.translateToString(true)); // trimRight = true
          }
        }

        const snapshot = lines.join('\n');
        agentStatusManager.feedBufferSnapshot(props.laneId, snapshot);
      }, 250);

      onCleanup(() => clearInterval(bufferCheckInterval));

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
    agentStatusManager.unregisterLane(props.laneId);
    if (pty) {
      try {
        await pty.kill();
      } catch (error) {
        console.error('Failed to kill PTY:', error);
      }
    }

    if (terminal) {
      terminal.dispose();
    }
  });

  const handleEnableNotification = (type: 'done' | 'input' | 'both') => {
    if (type === 'done' || type === 'both') {
      agentStatusManager.updateNotificationSettings({ notifyOnDone: true });
    }
    if (type === 'input' || type === 'both') {
      agentStatusManager.updateNotificationSettings({ notifyOnWaitingForInput: true });
    }
    setShowNotificationPrompt(false);
  };

  const handleDismissPrompt = () => {
    agentStatusManager.dismissNotificationPrompt();
    setShowNotificationPrompt(false);
  };

  return (
    <div class="relative w-full h-full">
      <div
        ref={containerRef}
        class="w-full h-full bg-zed-bg-panel"
      />
      <Show when={showNotificationPrompt()}>
        <div class="absolute bottom-3 left-3 right-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-zed-bg-overlay border border-zed-border-default shadow-lg animate-slide-up">
          <svg class="w-4 h-4 text-zed-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="text-xs text-zed-text-secondary flex-1">Get notified when the agent finishes or needs your input?</span>
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="px-2.5 py-1 text-xs font-medium text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface rounded border border-zed-border-default transition-colors"
              onClick={() => handleEnableNotification('done')}
            >
              When finished
            </button>
            <button
              class="px-2.5 py-1 text-xs font-medium text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface rounded border border-zed-border-default transition-colors"
              onClick={() => handleEnableNotification('input')}
            >
              When needs input
            </button>
            <button
              class="px-2.5 py-1 text-xs font-medium text-white bg-zed-accent-blue hover:bg-zed-accent-blue-hover rounded transition-colors"
              onClick={() => handleEnableNotification('both')}
            >
              Both
            </button>
            <button
              class="p-1 text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
              onClick={handleDismissPrompt}
              title="Don't ask again"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
