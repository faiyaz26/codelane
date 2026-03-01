import { createSignal, onMount, For, createEffect, Show } from 'solid-js';
import type { WizardData } from '../OnboardingWizard';
import type { AgentConfig, AgentType } from '../../../types/agent';
import { defaultAgentSettings } from '../../../types/agent';
import { checkCommandExists } from '../../../lib/settings-api';

interface AgentSetupStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function AgentSetupStep(props: AgentSetupStepProps) {
  const [commandExists, setCommandExists] = createSignal<boolean | null>(null);
  const [isChecking, setIsChecking] = createSignal(false);

  // Initialize with Claude Code as default if no agent selected
  onMount(() => {
    if (!props.data.agent) {
      props.onDataChange({ agent: defaultAgentSettings.presets.claude });
    }
  });

  // Check if command exists when agent changes
  createEffect(async () => {
    const command = props.data.agent?.command;
    if (!command) return;

    setIsChecking(true);
    const result = await checkCommandExists(command);
    setCommandExists(result !== null);
    setIsChecking(false);
  });

  const handleAgentTypeChange = (type: AgentType) => {
    const preset = defaultAgentSettings.presets[type];
    if (preset) {
      props.onDataChange({ agent: preset });
    }
  };

  const agentOptions: { value: AgentType; label: string }[] = [
    { value: 'claude', label: 'Claude Code CLI' },
    { value: 'gemini', label: 'Gemini CLI' },
    { value: 'aider', label: 'Aider CLI' },
    { value: 'shell', label: 'Shell (Traditional Terminal)' },
    { value: 'cursor', label: 'Cursor CLI' },
    { value: 'opencode', label: 'OpenCode CLI' },
    { value: 'codex', label: 'OpenAI Codex CLI' },
  ];

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Which AI coding assistant would you like to use by default?
          You can add more or customize them later in Settings.
        </p>
      </div>

      {/* Preset Selector */}
      <div class="mb-8">
        <label class="block text-sm font-medium text-zed-text-primary mb-2">
          Select Agent
        </label>
        <div class="space-y-4">
          <select
            class="w-full h-12 px-4 bg-zed-bg-surface border border-zed-border-default rounded-lg text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue transition-all"
            value={props.data.agent?.agentType || 'claude'}
            onChange={(e) => handleAgentTypeChange(e.currentTarget.value as AgentType)}
          >
            <For each={agentOptions}>
              {(option) => (
                <option value={option.value}>{option.label}</option>
              )}
            </For>
          </select>

          {/* Installation Status */}
          <div class="flex items-center gap-2 px-1">
            <Show when={isChecking()}>
              <div class="w-3 h-3 border-2 border-zed-accent-blue border-t-transparent rounded-full animate-spin" />
              <span class="text-xs text-zed-text-tertiary">Checking installation...</span>
            </Show>
            <Show when={!isChecking() && commandExists() === true}>
              <div class="w-3 h-3 bg-green-500 rounded-full" />
              <span class="text-xs text-green-500 font-medium">Ready to use — "{props.data.agent?.command}" found in your PATH</span>
            </Show>
            <Show when={!isChecking() && commandExists() === false}>
              <div class="w-3 h-3 bg-red-500 rounded-full" />
              <span class="text-xs text-red-500 font-medium">Not found — you'll need to install "{props.data.agent?.command}" manually</span>
            </Show>
          </div>
        </div>
      </div>

      {/* Tutorial Content (Inline Tips) */}
      <div class="bg-zed-bg-hover p-5 rounded-xl border border-zed-border-subtle">
        <h3 class="font-semibold text-zed-text-primary mb-3 flex items-center gap-2">
          <svg class="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>What are agents?</span>
        </h3>
        <p class="text-sm text-zed-text-secondary mb-4 leading-relaxed">
          AI coding assistants run inside your lane terminals. They can understand your code, 
          perform refactors, and execute terminal commands to help you build faster.
        </p>
        <div class="text-xs text-zed-text-tertiary">
          <p>• <span class="text-zed-text-secondary font-medium">Claude Code</span> is great for deep architectural understanding.</p>
          <p class="mt-1">• <span class="text-zed-text-secondary font-medium">Aider</span> is excellent for rapid, iterative code changes.</p>
          <p class="mt-1">• <span class="text-zed-text-secondary font-medium">Shell</span> is a standard terminal for when you want full manual control.</p>
        </div>
      </div>
    </div>
  );
}
