import { createSignal, onMount } from 'solid-js';
import { AgentSelector } from '../../AgentSelector';
import type { WizardData } from '../OnboardingWizard';
import type { AgentConfig } from '../../../types/agent';
import { defaultAgentSettings } from '../../../types/agent';

interface AgentSetupStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function AgentSetupStep(props: AgentSetupStepProps) {
  const [isValid, setIsValid] = createSignal(false);

  // Initialize with Claude Code as default if no agent selected
  onMount(() => {
    if (!props.data.agent) {
      props.onDataChange({ agent: defaultAgentSettings.presets.claude });
    }
  });

  const handleAgentChange = (config: AgentConfig) => {
    props.onDataChange({ agent: config });
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Select which AI coding assistant you'd like to use with Codelane.
          You can change this later in Settings.
        </p>
      </div>

      {/* Agent Selector */}
      <div class="mb-6">
        <AgentSelector
          value={props.data.agent || defaultAgentSettings.presets.claude}
          onChange={handleAgentChange}
          presets={defaultAgentSettings.presets}
          onValidationChange={setIsValid}
        />
      </div>

      {/* Tutorial Content (Inline Tips) */}
      <div class="bg-zed-bg-hover p-4 rounded-lg">
        <h3 class="font-semibold text-zed-text-primary mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>What are agents?</span>
        </h3>
        <p class="text-sm text-zed-text-secondary mb-3 pl-8">
          AI coding assistants like Claude Code, Cursor, or Aider that help
          you write code, refactor, and debug. They run in lane terminals and
          can automatically make changes to your codebase.
        </p>
        <details class="pl-8">
          <summary class="text-sm text-zed-accent-blue cursor-pointer hover:underline">
            Learn more about configuring agents
          </summary>
          <p class="mt-2 text-sm text-zed-text-tertiary">
            Each agent has different strengths. Claude Code excels at understanding
            context, Cursor integrates with editors, and Aider is great for rapid
            iterations. You can configure multiple agents and switch between them
            per lane.
          </p>
        </details>
      </div>
    </div>
  );
}
