import { onCleanup, onMount, createEffect, createSignal, Show, untrack } from 'solid-js';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { spawn, type PtyHandle } from '../services/PortablePty';
import { getTerminalTheme } from '../theme';
import { themeManager } from '../services/ThemeManager';
import { getLaneAgentConfig, checkCommandExists } from '../lib/settings-api';
import { createTerminal, createFitAddon, loadAddons, attachKeyHandlers, updateTerminalTheme } from '../lib/terminal-utils';
import { agentStatusManager } from '../services/AgentStatusManager';
import type { DetectableAgentType } from '../types/agentStatus';
import { HookOnboardingModal, shouldShowHookPrompt } from './hooks/HookOnboardingModal';
import type { AgentType } from '../types/agent';
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
  const [showHookOnboarding, setShowHookOnboarding] = createSignal(false);
  const [onboardingAgentType, setOnboardingAgentType] = createSignal<AgentType>('claude');
  const [userHasScrolledUp, setUserHasScrolledUp] = createSignal(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = createSignal(true);
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

    // Use untrack to pin this terminal instance to the specific lane/cwd it was created for.
    // This prevents switching lanes from re-running this initialization logic.
    const laneId = untrack(() => props.laneId);
    const cwd = untrack(() => props.cwd);

    // Create xterm.js instance with shared configuration
    terminal = createTerminal();
    fitAddon = createFitAddon(terminal);

    // Open terminal in the container
    terminal.open(containerRef);

    // Load rendering + utility addons (must be after open() for WebGL)
    loadAddons(terminal);

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
        CODELANE_LANE_ID: laneId,
        CODELANE_SESSION_ID: `${laneId}-${Date.now()}`,
      };

      // Load agent config only if useAgent is true
      if (useAgent) {
        agentConfig = await getLaneAgentConfig(laneId);

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
                cwd: agentConfig.useLaneCwd ? cwd : undefined,
                env,
              });

              spawnSuccess = true;
            } catch (spawnError) {
              console.error('[TerminalView] Failed to spawn agent:', spawnError);
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
          cwd: cwd,
          env: baseEnv,
        });
      }

      // Track resolved agent type for status detection
      const resolvedAgentType: DetectableAgentType = (spawnSuccess && useAgent)
        ? (agentConfig?.agentType || 'shell') as DetectableAgentType
        : 'shell';
      await agentStatusManager.registerLane(laneId, resolvedAgentType);
      isAgentLane = resolvedAgentType !== 'shell';

      // Show notification prompt when agent first starts working
      if (isAgentLane) {
        const unsub = agentStatusManager.onStatusChange((change) => {
          if (
            change.laneId === laneId &&
            change.newStatus === 'working' &&
            agentStatusManager.shouldShowNotificationPrompt()
          ) {
            setShowNotificationPrompt(true);
            unsub();
          }
        });
        onCleanup(unsub);
      }

      // Show hook onboarding modal for hook-supported agents on first run
      const hookSupportedAgents: AgentType[] = ['claude', 'codex', 'gemini'];
      if (
        isAgentLane &&
        hookSupportedAgents.includes(resolvedAgentType as AgentType) &&
        shouldShowHookPrompt(resolvedAgentType as AgentType)
      ) {
        setTimeout(() => {
          setOnboardingAgentType(resolvedAgentType as AgentType);
          setShowHookOnboarding(true);
        }, 2000); // Delay to avoid startup disruption
      }

      // Attach custom key handlers (Shift+Enter, etc.)
      attachKeyHandlers(terminal, (data) => pty!.write(data));

      // Sticky scroll detection
      const updateScrollState = () => {
        if (!terminal) return;
        const buffer = terminal.buffer.active;
        // viewportY is current scroll position, baseY is the maximum possible scroll position (the bottom)
        const atBottom = buffer.viewportY >= buffer.baseY;
        
        setIsAutoScrollEnabled(atBottom);
        setUserHasScrolledUp(!atBottom);
      };

      // Listen for scroll events
      terminal.onScroll(() => {
        updateScrollState();
      });

      // Also listen for wheel events to catch manual scroll-up faster
      const handleWheel = () => {
        // Use requestAnimationFrame to allow xterm to update its internal scroll position
        // before we check the state.
        requestAnimationFrame(updateScrollState);
      };
      containerRef.addEventListener('wheel', handleWheel, { passive: true });

      // Listen for window title changes from the PTY (useful for Gemini CLI)
      terminal.onTitleChange((title) => {
        agentStatusManager.feedWindowTitle(laneId, title);
      });

      // Set up event-based data flow (low latency!)
      // PTY output → terminal (with sticky scroll)
      await pty!.onData((data) => {
        if (terminal) {
          terminal.write(data);
          if (isAutoScrollEnabled()) {
            terminal.scrollToBottom();
          }
        }
        // Feed output to agent status detector
        agentStatusManager.feedOutput(laneId, data);
      });

      // Terminal input → PTY
      terminal.onData((data) => {
        if (pty) {
          pty.write(data);
        }
        // Signal user input to agent status detector (transitions out of waiting_for_input)
        agentStatusManager.feedUserInput(laneId, data);
      });

      // Handle PTY exit
      await pty!.onExit(() => {
        if (terminal) {
          terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
        }
        props.onTerminalExit?.();
        agentStatusManager.markExited(laneId);
      });

      // Call ready callback with terminal ID
      props.onTerminalReady?.(pty!.id);

      // Safe fit that guards against zero dimensions and preserves scroll position
      const safeFitAndResize = () => {
        if (!fitAddon || !terminal || !pty || !containerRef) return;
        // Skip if container has no visible dimensions (collapsed/hidden)
        const rect = containerRef.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;

        // Check if scrolled to bottom before fit
        const buffer = terminal.buffer.active;
        const isAtBottom = buffer.baseY + terminal.rows >= buffer.length;

        fitAddon.fit();
        pty.resize(terminal.cols, terminal.rows);

        // Force full re-render to clear any stale WebGL texture artifacts
        terminal.refresh(0, terminal.rows - 1);

        // Restore scroll position: stay at bottom if we were at bottom
        if (isAtBottom) {
          terminal.scrollToBottom();
        }
      };

      // Handle resize events with debouncing
      let resizeTimeout: number | undefined;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(safeFitAndResize, 100) as unknown as number;
      });

      if (containerRef) {
        resizeObserver.observe(containerRef);
      }

      // Initial resize
      setTimeout(() => {
        safeFitAndResize();
        // Scroll to bottom after initial layout
        if (terminal) terminal.scrollToBottom();
      }, 100);

      // Listen for custom terminal resize events
      const handleTerminalResize = () => safeFitAndResize();
      window.addEventListener('terminal-resize', handleTerminalResize);

      // Focus terminal and refresh rendering when its lane becomes active
      const handleTerminalFocus = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.laneId === laneId && terminal) {
          terminal.focus();
          // Force full re-render to fix stale WebGL texture after being hidden
          terminal.refresh(0, terminal.rows - 1);
        }
      };
      window.addEventListener('terminal-focus', handleTerminalFocus);

      // Cleanup
      onCleanup(() => {
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener('terminal-resize', handleTerminalResize);
        window.removeEventListener('terminal-focus', handleTerminalFocus);
        if (containerRef) {
          containerRef.removeEventListener('wheel', handleWheel);
        }
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
    // Note: laneId is captured via untrack in onMount scope, 
    // but here we can just use props.laneId as we are unmounting anyway
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

  const scrollToBottom = () => {
    if (terminal) {
      terminal.scrollToBottom();
      setIsAutoScrollEnabled(true);
      setUserHasScrolledUp(false);
    }
  };

  return (
    <div class="relative w-full h-full group">
      <div
        ref={containerRef}
        class="w-full h-full bg-zed-bg-panel"
      />

      <Show when={userHasScrolledUp()}>
        <button
          onClick={scrollToBottom}
          class="absolute bottom-10 right-10 px-4 py-2 bg-zed-accent-blue text-white rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold hover:bg-zed-accent-blue-hover transition-all animate-bounce-in z-20 cursor-pointer"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
          </svg>
          Scroll to Bottom
        </button>
      </Show>

      <Show when={showNotificationPrompt()}>
        <div class="absolute top-3 left-3 right-3 flex items-center gap-3 px-4 py-3 rounded-lg bg-zed-bg-overlay border border-zed-border-default shadow-lg animate-slide-down z-10">
          <svg class="w-4 h-4 text-zed-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="text-xs text-zed-text-secondary flex-1">Get notified when the agent finishes or needs your input?</span>
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="px-2.5 py-1 text-xs font-medium text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface rounded border border-zed-border-default transition-colors cursor-pointer select-none"
              onClick={() => handleEnableNotification('done')}
            >
              When finished
            </button>
            <button
              class="px-2.5 py-1 text-xs font-medium text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface rounded border border-zed-border-default transition-colors cursor-pointer select-none"
              onClick={() => handleEnableNotification('input')}
            >
              When needs input
            </button>
            <button
              class="px-2.5 py-1 text-xs font-medium text-white bg-zed-accent-blue hover:bg-zed-accent-blue-hover rounded transition-colors cursor-pointer select-none"
              onClick={() => handleEnableNotification('both')}
            >
              Both
            </button>
            <button
              class="p-1 text-zed-text-tertiary hover:text-zed-text-primary transition-colors cursor-pointer select-none"
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

      <HookOnboardingModal
        agentType={onboardingAgentType()}
        open={showHookOnboarding()}
        onClose={() => setShowHookOnboarding(false)}
      />
    </div>
  );
}
