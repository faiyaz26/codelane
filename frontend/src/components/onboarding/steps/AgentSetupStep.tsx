import { createSignal, onMount, For, createEffect, Show } from 'solid-js';
import { AgentSelector } from '../../AgentSelector';
import type { WizardData } from '../OnboardingWizard';
import type { AgentConfig, AgentType } from '../../../types/agent';
import { defaultAgentSettings, defaultShellAgent } from '../../../types/agent';
import { checkCommandExists } from '../../../lib/settings-api';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';

interface AgentSetupStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function AgentSetupStep(props: AgentSetupStepProps) {
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

  onMount(() => {
    verifyAllAgents();
  });

  // Re-verify when installedAgents changes
  createEffect(() => {
    verifyAllAgents();
  });

  const verifyAllAgents = async () => {
    const agents = props.data.installedAgents || [];
    const statuses: Record<number, boolean> = {};
    for (let i = 0; i < agents.length; i++) {
      const exists = await checkCommandExists(agents[i].command);
      statuses[i] = exists !== null;
    }
    setAgentStatuses(statuses);
  };

  const handleAddAgent = () => {
    const agent = newAgent();
    if (!agent.name || !agent.command) return;

    const agents = [...props.data.installedAgents];
    if (editingIndex() !== null) {
      agents[editingIndex()!] = agent;
    } else {
      agents.push(agent);
    }

    props.onDataChange({ installedAgents: agents });
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
  };

  const handleEditAgent = (index: number) => {
    const agent = props.data.installedAgents[index];
    setNewAgent({ ...agent });
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleRemoveAgent = (index: number) => {
    const agents = [...props.data.installedAgents];
    const removedAgent = agents[index];
    agents.splice(index, 1);
    
    // If we removed the default agent, reset default to the first one
    let defaultName = props.data.defaultAgentName;
    if (removedAgent.name === props.data.defaultAgentName) {
      defaultName = agents[0]?.name || '';
    }
    
    props.onDataChange({ installedAgents: agents, defaultAgentName: defaultName });
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
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Codelane uses AI agents to help you build. Select your default agent and add any others you'd like to use.
        </p>
      </div>

      <div class="space-y-6">
        {/* Installed Agents Section */}
        <div class="bg-zed-bg-surface rounded-xl border border-zed-border-default overflow-hidden">
          <div class="px-4 py-3 border-b border-zed-border-default flex items-center justify-between bg-zed-bg-panel">
            <h3 class="text-sm font-medium text-zed-text-primary">Installed Agents</h3>
            <Show when={!showAddForm()}>
              <button
                onClick={() => setShowAddForm(true)}
                class="text-xs font-medium text-zed-accent-blue hover:text-zed-accent-blue/80 transition-colors"
              >
                + Add Agent
              </button>
            </Show>
          </div>

          <div class="p-4">
            <Show when={showAddForm()}>
              <div class="p-4 bg-zed-bg-app rounded-lg border border-zed-border-active mb-6 space-y-4">
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
                  presets={defaultAgentSettings.presets}
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
              <For each={props.data.installedAgents || []}>
                {(agent, index) => (
                  <div class="p-3 rounded-lg bg-zed-bg-app border border-zed-border-default group hover:border-zed-border-active transition-all">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class={`w-2 h-2 rounded-full ${agentStatuses()[index()] ? 'bg-green-500' : 'bg-red-500'}`} 
                             title={agentStatuses()[index()] ? 'Installed' : 'Command not found'} />
                        <div>
                          <p class="text-sm font-medium text-zed-text-primary">{agent.name || getAgentDisplayName(agent.agentType)}</p>
                          <p class="text-[10px] text-zed-text-tertiary font-mono opacity-70">{agent.command}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditAgent(index())}
                          class="p-1.5 text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveAgent(index())}
                          class="p-1.5 text-zed-text-tertiary hover:text-zed-accent-red hover:bg-zed-bg-hover rounded transition-colors"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>

        {/* Default Preference */}
        <div class="p-4 bg-zed-bg-surface rounded-xl border border-zed-border-default">
          <label class="block text-sm font-medium text-zed-text-primary mb-2">
            Default Preference
          </label>
          <p class="text-xs text-zed-text-tertiary mb-3">
            This agent will be used for all new lanes.
          </p>
          <select
            class="w-full h-10 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue transition-all"
            value={props.data.defaultAgentName}
            onChange={(e) => props.onDataChange({ defaultAgentName: e.currentTarget.value })}
          >
            <For each={props.data.installedAgents || []}>
              {(agent) => (
                <option value={agent.name}>{agent.name}</option>
              )}
            </For>
          </select>
        </div>
      </div>

      {/* Tutorial Content (Inline Tips) */}
      <div class="mt-8 bg-zed-bg-hover p-5 rounded-xl border border-zed-border-subtle">
        <h3 class="font-semibold text-zed-text-primary mb-3 flex items-center gap-2">
          <svg class="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Pro Tip: Switching Agents</span>
        </h3>
        <p class="text-sm text-zed-text-secondary leading-relaxed">
          You can switch between these agents at any time from the terminal header in any lane. 
          Each lane remembers its selected agent.
        </p>
      </div>
    </div>
  );
}
