// Agents Settings Tab

import { createSignal, onMount, For, Show } from 'solid-js';
import { AgentSelector } from '../AgentSelector';
import type { AgentSettings, AgentType, AgentConfig } from '../../types/agent';
import { hookService } from '../../services/HookService';
import type { HookStatus } from '../../types/hooks';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { checkCommandExists } from '../../lib/settings-api';

interface AgentsSettingsProps {
  settings: AgentSettings;
  onSettingsChange: (fn: (s: AgentSettings | null) => AgentSettings | null) => void;
  onValidationChange: (valid: boolean) => void;
}

export function AgentsSettings(props: AgentsSettingsProps) {
  const [hookStatuses, setHookStatuses] = createSignal<Record<string, HookStatus>>({});
  const [loadingHook, setLoadingHook] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [editingIndex, setEditingIndex] = createSignal<number | null>(null);
  const [agentStatuses, setAgentStatuses] = createSignal<Record<number, boolean>>({});

  const [newAgent, setNewAgent] = createSignal<AgentConfig>({
    name: '',
    agentType: 'claude',
    command: '',
    args: [],
    env: {},
    useLaneCwd: true,
  });

  onMount(async () => {
    const statuses = await hookService.getAllStatus();
    setHookStatuses(statuses);
    verifyAllAgents();
    props.onValidationChange(true); // Default to valid unless AgentSelector says otherwise
  });

  const verifyAllAgents = async () => {
    const agents = props.settings.installedAgents || [];
    const statuses: Record<number, boolean> = {};
    for (let i = 0; i < agents.length; i++) {
      const exists = await checkCommandExists(agents[i].command);
      statuses[i] = exists !== null;
    }
    setAgentStatuses(statuses);
  };

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

  const handleAddAgent = () => {
    const agent = newAgent();
    if (!agent.name || !agent.command) return;

    props.onSettingsChange((s) => {
      if (!s) return null;
      const agents = [...(s.installedAgents || [])];
      if (editingIndex() !== null) {
        agents[editingIndex()!] = agent;
      } else {
        agents.push(agent);
      }
      return { ...s, installedAgents: agents };
    });

    setShowAddForm(false);
    setEditingIndex(null);
    setNewAgent({
      name: '',
      agentType: 'claude',
      command: '',
      args: [],
      env: {},
      useLaneCwd: true,
    });
    verifyAllAgents();
  };

  const handleEditAgent = (index: number) => {
    const agent = props.settings.installedAgents[index];
    setNewAgent({ ...agent });
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleRemoveAgent = (index: number) => {
    props.onSettingsChange((s) => {
      if (!s) return null;
      const agents = [...(s.installedAgents || [])];
      const removedAgent = agents[index];
      agents.splice(index, 1);
      
      // If we removed the default agent, reset default to the first one
      let defaultName = s.defaultAgentName;
      if (removedAgent.name === s.defaultAgentName) {
        defaultName = agents[0]?.name || '';
      }
      
      return { ...s, installedAgents: agents, defaultAgentName: defaultName };
    });
    verifyAllAgents();
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
        Manage your installed AI agents and select your default preference.
      </p>

      <div class="space-y-8">
        {/* Installed Agents Section */}
        <div>
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-zed-text-primary">Installed Agents</h3>
            <Show when={!showAddForm()}>
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
                Add Agent
              </Button>
            </Show>
          </div>

          <Show when={showAddForm()}>
            <div class="p-4 bg-zed-bg-surface rounded-md border border-zed-border-active mb-4 space-y-4">
              <h4 class="text-xs font-semibold text-zed-text-secondary uppercase">
                {editingIndex() !== null ? 'Edit Agent' : 'Add New Agent'}
              </h4>
              <TextField
                label="Display Name"
                placeholder="e.g. Claude Code"
                value={newAgent().name || ''}
                onChange={(v) => setNewAgent({ ...newAgent(), name: v })}
              />
              <AgentSelector
                value={newAgent()}
                onChange={(config) => setNewAgent({ ...newAgent(), ...config })}
                presets={props.settings.presets}
              />
              <div class="flex justify-end gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setEditingIndex(null); }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleAddAgent} disabled={!newAgent().name || !newAgent().command}>
                  {editingIndex() !== null ? 'Update Agent' : 'Add Agent'}
                </Button>
              </div>
            </div>
          </Show>

          <div class="space-y-2">
            <For each={props.settings.installedAgents || []}>
              {(agent, index) => (
                <div class="p-3 rounded-lg bg-zed-bg-surface border border-zed-border-default group">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class={`w-2 h-2 rounded-full ${agentStatuses()[index()] ? 'bg-green-500' : 'bg-red-500'}`} 
                           title={agentStatuses()[index()] ? 'Installed' : 'Command not found'} />
                      <div>
                        <p class="text-sm font-medium text-zed-text-primary">{agent.name || getAgentDisplayName(agent.agentType)}</p>
                        <p class="text-xs text-zed-text-tertiary font-mono">{agent.command}</p>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditAgent(index())}
                        class="p-1.5 text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
                        title="Edit"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveAgent(index())}
                        class="p-1.5 text-zed-text-tertiary hover:text-zed-accent-red hover:bg-zed-bg-hover rounded transition-colors"
                        title="Remove"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Default Agent Section */}
        <div class="border-t border-zed-border-subtle pt-6">
          <h3 class="text-sm font-medium text-zed-text-primary mb-2">Default Preference</h3>
          <p class="text-xs text-zed-text-tertiary mb-4">
            New lanes will use this agent by default
          </p>
          
          <select
            class="w-full h-10 px-3 py-2 bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
            value={props.settings.defaultAgentName}
            onChange={(e) => props.onSettingsChange((s) => s ? { ...s, defaultAgentName: e.currentTarget.value } : null)}
          >
            <For each={props.settings.installedAgents || []}>
              {(agent) => (
                <option value={agent.name}>{agent.name}</option>
              )}
            </For>
          </select>
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
                Switch between your installed agents directly from any terminal header.
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
