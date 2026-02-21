// Agents Settings Tab

import { createSignal, onMount, For, Show } from 'solid-js';
import { AgentSelector } from '../AgentSelector';
import type { AgentSettings, AgentType } from '../../types/agent';
import { hookService } from '../../services/HookService';
import type { HookStatus } from '../../types/hooks';

interface AgentsSettingsProps {
  settings: AgentSettings;
  onSettingsChange: (fn: (s: AgentSettings | null) => AgentSettings | null) => void;
  onValidationChange: (valid: boolean) => void;
}

export function AgentsSettings(props: AgentsSettingsProps) {
  const [hookStatuses, setHookStatuses] = createSignal<Record<string, HookStatus>>({});
  const [loadingHook, setLoadingHook] = createSignal<string | null>(null);

  onMount(async () => {
    const statuses = await hookService.getAllStatus();
    setHookStatuses(statuses);
  });

  const handleInstallHook = async (agentType: AgentType) => {
    setLoadingHook(agentType);
    try {
      await hookService.installHooks(agentType);
      const status = await hookService.checkStatus(agentType);
      setHookStatuses({ ...hookStatuses(), [agentType]: status });
    } catch (error) {
      alert(`Failed to install hooks: ${error}`);
    } finally {
      setLoadingHook(null);
    }
  };

  const handleUninstallHook = async (agentType: AgentType) => {
    setLoadingHook(agentType);
    try {
      await hookService.uninstallHooks(agentType);
      const status = await hookService.checkStatus(agentType);
      setHookStatuses({ ...hookStatuses(), [agentType]: status });
    } catch (error) {
      alert(`Failed to uninstall hooks: ${error}`);
    } finally {
      setLoadingHook(null);
    }
  };

  const getAgentDisplayName = (agentType: AgentType): string => {
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
  };

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Agent Configuration</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Configure the default AI agent for your development workflow.
      </p>

      <div class="space-y-6">
        {/* Default Agent Section */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-3">Default Agent</h3>
          <AgentSelector
            value={props.settings.defaultAgent}
            onChange={(config) => props.onSettingsChange((s) => s ? { ...s, defaultAgent: config } : null)}
            presets={props.settings.presets}
            onValidationChange={props.onValidationChange}
          />
        </div>

        {/* Info */}
        <div class="p-4 bg-zed-bg-surface rounded-md border border-zed-border-default">
          <div class="flex gap-3">
            <svg class="w-5 h-5 text-zed-accent-blue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-zed-text-primary mb-1">Per-Lane Overrides</h4>
              <p class="text-xs text-zed-text-secondary">
                Individual lanes can override the default agent. Different projects can use different agents.
              </p>
            </div>
          </div>
        </div>

        {/* Hook Integration Section */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-2">Hook Integration</h3>
          <p class="text-xs text-zed-text-tertiary mb-4">
            Enable hooks for instant notifications when agents need your input
          </p>

          <div class="space-y-3">
            <For each={['claude', 'codex', 'gemini'] as AgentType[]}>
              {(agentType) => {
                const status = () => hookStatuses()[agentType];
                return (
                  <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-zed-text-primary">
                          {getAgentDisplayName(agentType)}
                        </p>
                        <p class="text-xs text-zed-text-tertiary mt-1">
                          {status()?.supported
                            ? status()?.installed
                              ? 'Hooks enabled - agent can notify Codelane'
                              : 'Hooks not installed'
                            : 'Hooks not supported for this agent'}
                        </p>
                      </div>

                      <Show when={status()?.supported}>
                        <Show
                          when={status()?.installed}
                          fallback={
                            <button
                              onClick={() => handleInstallHook(agentType)}
                              disabled={loadingHook() === agentType}
                              class="px-3 py-1.5 text-sm bg-zed-accent-blue text-white hover:bg-zed-accent-blue/90 rounded transition-colors disabled:opacity-50"
                            >
                              {loadingHook() === agentType ? 'Installing...' : 'Install'}
                            </button>
                          }
                        >
                          <button
                            onClick={() => handleUninstallHook(agentType)}
                            disabled={loadingHook() === agentType}
                            class="px-3 py-1.5 text-sm text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors disabled:opacity-50"
                          >
                            {loadingHook() === agentType ? 'Removing...' : 'Uninstall'}
                          </button>
                        </Show>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
