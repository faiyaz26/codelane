import { onCleanup, onMount, createSignal, Show } from 'solid-js';
import { useTerminalPool } from '../hooks/useTerminalPool';
import { TerminalInstance } from './terminal/TerminalInstance';
import type { TerminalHandle } from '../types/terminal';
import { agentStatusManager } from '../services/AgentStatusManager';
import { HookOnboardingModal, shouldShowHookPrompt } from './hooks/HookOnboardingModal';
import type { AgentType } from '../types/agent';
import { getLaneAgentConfig } from '../lib/settings-api';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  laneId: string;
  cwd?: string;
  version?: number; // Reload version to ensure unique ID
  useAgent?: boolean; // If false, use plain shell instead of agent
  onTerminalReady?: (terminalId: string) => void;
  onTerminalExit?: () => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

export function TerminalView(props: TerminalViewProps) {
  const terminalPool = useTerminalPool();
  const [handle, setHandle] = createSignal<TerminalHandle | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  const [showNotificationPrompt, setShowNotificationPrompt] = createSignal(false);
  const [showHookOnboarding, setShowHookOnboarding] = createSignal(false);
  const [onboardingAgentType, setOnboardingAgentType] = createSignal<AgentType>('claude');
  
  const terminalId = () => `${props.laneId}-agent${props.version ? `-${props.version}` : ''}`;

  // Acquire terminal on mount
  onMount(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const h = await terminalPool.acquire({
        id: terminalId(),
        laneId: props.laneId,
        cwd: props.cwd,
        useAgent: props.useAgent !== false,
      });
      setHandle(h);
      
      // Notify parent
      props.onTerminalReady?.(h.id);

      // Handle exit callback
      // Note: TerminalPool already handles agentStatusManager.markExited
      const pty = h.pty;
      const unExit = await pty.onExit(() => {
        props.onTerminalExit?.();
      });
      onCleanup(() => unExit());

      // Show onboarding/prompts if needed
      const laneId = props.laneId;
      const useAgent = props.useAgent !== false;
      if (useAgent) {
        const agentConfig = await getLaneAgentConfig(laneId);
        const resolvedAgentType = agentConfig.agentType;

        // Show notification prompt when agent first starts working
        if (resolvedAgentType !== 'shell') {
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

          // Show hook onboarding
          const hookSupportedAgents: AgentType[] = ['claude', 'codex', 'gemini'];
          if (
            hookSupportedAgents.includes(resolvedAgentType as AgentType) &&
            shouldShowHookPrompt(resolvedAgentType as AgentType)
          ) {
            setTimeout(() => {
              setOnboardingAgentType(resolvedAgentType as AgentType);
              setShowHookOnboarding(true);
            }, 2000);
          }
        }
      }
    } catch (err) {
      console.error('[TerminalView] Failed to acquire terminal:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  });

  // Release PTY when component unmounts
  onCleanup(async () => {
    const h = handle();
    if (h) {
      try {
        await terminalPool.release(h.id);
      } catch (error) {
        console.error('Failed to release terminal in cleanup:', error);
      }
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
    <div class="relative w-full h-full group">
      <Show
        when={!isLoading() && !error() && handle()}
        fallback={
          <div class="w-full h-full flex items-center justify-center bg-zed-bg-panel">
            <div class="text-zed-text-secondary">
              <Show when={isLoading()}>
                <div class="flex items-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-zed-accent-blue border-t-transparent"></div>
                  <span>Starting agent...</span>
                </div>
              </Show>
              <Show when={error()}>
                <div class="text-zed-accent-red">
                  <div class="font-semibold">Failed to start agent</div>
                  <div class="text-sm mt-1">{error()}</div>
                </div>
              </Show>
            </div>
          </div>
        }
      >
        {(h) => <TerminalInstance handle={h()} laneId={props.laneId} workingDir={props.cwd} />}
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
