/**
 * First-run onboarding modal for hook installation.
 *
 * Shows when a hook-supported agent (Claude, Codex, Gemini) runs for the first time.
 * Explains the benefits of hooks and offers to install them.
 */

import { Show, createSignal } from 'solid-js';
import { Dialog } from '../ui/Dialog';
import type { AgentType } from '../../types/agent';
import { hookService } from '../../services/HookService';

interface HookOnboardingModalProps {
  agentType: AgentType;
  open: boolean;
  onClose: () => void;
}

export function HookOnboardingModal(props: HookOnboardingModalProps) {
  const [installing, setInstalling] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);

    try {
      await hookService.installHooks(props.agentType);
      markPromptShown(props.agentType);
      props.onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setInstalling(false);
    }
  };

  const handleSkip = () => {
    markPromptShown(props.agentType);
    props.onClose();
  };

  const handleDontAskAgain = () => {
    localStorage.setItem(`codelane:hook-prompt-${props.agentType}`, 'dismissed');
    props.onClose();
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onClose()}
      title={`Enable ${getAgentName(props.agentType)} Notifications?`}
      description="Get instant notifications when your agent needs input"
    >
      <div class="space-y-4">
        <div class="text-sm text-zed-text-secondary space-y-3">
          <p>
            Codelane can integrate with {getAgentName(props.agentType)} to instantly notify you
            when the agent is waiting for your input.
          </p>
          <div class="p-3 rounded-lg bg-zed-bg-hover">
            <p class="text-xs font-medium text-zed-text-primary mb-2">Benefits:</p>
            <ul class="list-disc list-inside space-y-1 text-xs text-zed-text-tertiary">
              <li>Know immediately when action is needed</li>
              <li>No need to check terminals manually</li>
              <li>Works across all lanes</li>
              <li>More reliable than text pattern detection</li>
            </ul>
          </div>
          <p class="text-xs text-zed-text-tertiary">
            This requires installing a small hook script in your {getAgentName(props.agentType)}{' '}
            configuration directory.
          </p>
        </div>

        <Show when={error()}>
          <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
            {error()}
          </div>
        </Show>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-zed-border-default">
          <button
            onClick={handleDontAskAgain}
            class="text-xs text-zed-text-disabled hover:text-zed-text-tertiary transition-colors"
            disabled={installing()}
          >
            Don't ask again
          </button>

          <div class="flex gap-2">
            <button
              onClick={handleSkip}
              disabled={installing()}
              class="px-3 py-1.5 text-sm text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={handleInstall}
              disabled={installing()}
              class="px-4 py-1.5 text-sm bg-zed-accent-blue text-white hover:bg-zed-accent-blue/90 rounded transition-colors disabled:opacity-50"
            >
              {installing() ? 'Installing...' : 'Enable Notifications'}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Get display name for an agent type
 */
function getAgentName(agentType: AgentType): string {
  const names: Record<AgentType, string> = {
    claude: 'Claude Code',
    codex: 'Codex',
    gemini: 'Gemini',
    aider: 'Aider',
    cursor: 'Cursor',
    opencode: 'OpenCode',
    shell: 'Shell',
  };
  return names[agentType] || agentType;
}

/**
 * Mark that the hook prompt has been shown for an agent
 */
function markPromptShown(agentType: AgentType): void {
  localStorage.setItem(`codelane:hook-prompt-${agentType}`, 'shown');
}

/**
 * Check if the hook prompt should be shown for an agent.
 * Returns true if the prompt hasn't been shown or dismissed.
 */
export function shouldShowHookPrompt(agentType: AgentType): boolean {
  const key = `codelane:hook-prompt-${agentType}`;
  const value = localStorage.getItem(key);
  return value !== 'shown' && value !== 'dismissed';
}
