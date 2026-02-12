// Agents Settings Tab

import { createSignal, onMount, For, Show } from 'solid-js';
import { AgentSelector } from '../AgentSelector';
import type { AgentSettings, AgentType } from '../../types/agent';
import { aiReviewService, type AITool, AI_MODELS } from '../../services/AIReviewService';
import { hookService } from '../../services/HookService';
import type { HookStatus } from '../../types/hooks';

interface AgentsSettingsProps {
  settings: AgentSettings;
  onSettingsChange: (fn: (s: AgentSettings | null) => AgentSettings | null) => void;
  onValidationChange: (valid: boolean) => void;
}

export function AgentsSettings(props: AgentsSettingsProps) {
  const [aiTool, setAiTool] = createSignal<AITool>('claude');
  const [aiModel, setAiModel] = createSignal<string>('haiku');
  const [availableTools, setAvailableTools] = createSignal<AITool[]>([]);
  const [testingTool, setTestingTool] = createSignal(false);
  const [hookStatuses, setHookStatuses] = createSignal<Record<string, HookStatus>>({});
  const [loadingHook, setLoadingHook] = createSignal<string | null>(null);

  // Load AI tool settings
  onMount(async () => {
    const savedTool = localStorage.getItem('codelane:aiTool');
    if (savedTool && ['claude', 'aider', 'opencode', 'gemini'].includes(savedTool)) {
      setAiTool(savedTool as AITool);
    }

    // Load saved model for current tool
    const savedModel = localStorage.getItem(`codelane:aiModel:${aiTool()}`);
    if (savedModel) {
      setAiModel(savedModel);
    } else {
      // Set default model (first option for each tool)
      setAiModel(AI_MODELS[aiTool()][0].value);
    }

    // Load available AI tools
    const tools = await aiReviewService.getAvailableTools();
    setAvailableTools(tools);

    // Load hook statuses
    const statuses = await hookService.getAllStatus();
    setHookStatuses(statuses);
  });

  const handleAIToolChange = (tool: AITool) => {
    setAiTool(tool);
    localStorage.setItem('codelane:aiTool', tool);

    // Load saved model for new tool or use default
    const savedModel = localStorage.getItem(`codelane:aiModel:${tool}`);
    if (savedModel) {
      setAiModel(savedModel);
    } else {
      setAiModel(AI_MODELS[tool][0].value);
    }
  };

  const handleAIModelChange = (model: string) => {
    setAiModel(model);
    localStorage.setItem(`codelane:aiModel:${aiTool()}`, model);
  };

  const handleTestAITool = async () => {
    setTestingTool(true);
    try {
      const isAvailable = await aiReviewService.testTool(aiTool());
      if (isAvailable) {
        alert(`✓ ${aiTool()} is installed and available!`);
      } else {
        alert(`✗ ${aiTool()} is not installed or not found in PATH.`);
      }
    } catch (error) {
      alert(`Error testing tool: ${error}`);
    } finally {
      setTestingTool(false);
    }
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

        {/* AI Code Changes Summary Settings */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">AI Code Changes Summary</h3>

          {/* AI Tool Selection */}
          <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 mr-4">
                <p class="text-sm font-medium text-zed-text-primary">AI Tool</p>
                <p class="text-xs text-zed-text-tertiary mt-1">
                  Choose which local AI CLI tool to use for code summaries
                </p>
              </div>
              <div class="flex items-center gap-2">
                <select
                  class="px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
                  value={aiTool()}
                  onChange={(e) => handleAIToolChange(e.target.value as AITool)}
                >
                  <option value="claude">Claude Code</option>
                  <option value="aider">Aider</option>
                  <option value="opencode">OpenCode</option>
                  <option value="gemini">Gemini CLI</option>
                </select>
                <button
                  onClick={handleTestAITool}
                  disabled={testingTool()}
                  class="px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary hover:bg-zed-bg-hover disabled:opacity-50 transition-colors"
                  title="Test if tool is installed"
                >
                  {testingTool() ? 'Testing...' : 'Test'}
                </button>
              </div>
            </div>

            {/* Model selection */}
            <div class="mt-4 pt-4 border-t border-zed-border-subtle">
              <div class="flex items-start justify-between">
                <div class="flex-1 mr-4">
                  <p class="text-sm font-medium text-zed-text-primary">Model</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Select which model to use for code summaries
                  </p>
                </div>
                <select
                  class="px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
                  value={aiModel()}
                  onChange={(e) => handleAIModelChange(e.target.value)}
                >
                  {AI_MODELS[aiTool()].map((model) => (
                    <option value={model.value}>{model.label}</option>
                  ))}
                </select>
              </div>
              {/* Model description */}
              <div class="mt-2 text-xs text-zed-text-disabled">
                {AI_MODELS[aiTool()].find(m => m.value === aiModel())?.description}
              </div>
            </div>

            {/* Tool descriptions */}
            <div class="mt-4 pt-4 border-t border-zed-border-subtle text-xs text-zed-text-disabled">
              {aiTool() === 'claude' && (
                <div>
                  <p class="mb-2">
                    <strong class="text-zed-text-tertiary">Claude Code:</strong> Anthropic's official CLI for Claude AI.
                  </p>
                  <p class="text-zed-text-tertiary">
                    Install: <code class="px-1 py-0.5 bg-zed-bg-panel rounded">npm install -g @anthropic-ai/claude-code</code>
                  </p>
                </div>
              )}
              {aiTool() === 'aider' && (
                <div>
                  <p class="mb-2">
                    <strong class="text-zed-text-tertiary">Aider:</strong> AI pair programming in your terminal.
                  </p>
                  <p class="text-zed-text-tertiary">
                    Install: <code class="px-1 py-0.5 bg-zed-bg-panel rounded">pip install aider-chat</code>
                  </p>
                </div>
              )}
              {aiTool() === 'opencode' && (
                <div>
                  <p class="mb-2">
                    <strong class="text-zed-text-tertiary">OpenCode:</strong> Open-source code assistant.
                  </p>
                  <p class="text-zed-text-tertiary">
                    Install: <code class="px-1 py-0.5 bg-zed-bg-panel rounded">npm install -g opencode</code>
                  </p>
                </div>
              )}
              {aiTool() === 'gemini' && (
                <div>
                  <p class="mb-2">
                    <strong class="text-zed-text-tertiary">Gemini CLI:</strong> Google's Gemini AI command-line tool.
                  </p>
                  <p class="text-zed-text-tertiary">
                    Install: <code class="px-1 py-0.5 bg-zed-bg-panel rounded">npm install -g @google/generative-ai-cli</code>
                  </p>
                </div>
              )}
            </div>

            {/* Available tools indicator */}
            {availableTools().length > 0 && (
              <div class="mt-3 pt-3 border-t border-zed-border-subtle">
                <p class="text-xs text-zed-text-tertiary">
                  <span class="text-green-400">✓</span> Available tools: {availableTools().join(', ')}
                </p>
              </div>
            )}
            {availableTools().length === 0 && (
              <div class="mt-3 pt-3 border-t border-zed-border-subtle">
                <p class="text-xs text-yellow-400">
                  ⚠ No AI tools found. Please install at least one tool to use AI code review features.
                </p>
              </div>
            )}
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
