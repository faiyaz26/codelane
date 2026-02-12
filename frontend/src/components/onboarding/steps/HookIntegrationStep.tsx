import type { WizardData } from '../OnboardingWizard';

interface HookIntegrationStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function HookIntegrationStep(props: HookIntegrationStepProps) {
  const agentName = props.data.agent?.agentType || 'your agent';

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Enable hooks to get instant, accurate notifications when your agent needs input.
        </p>
      </div>

      {/* Benefits List */}
      <div class="bg-zed-bg-hover p-6 rounded-lg mb-6">
        <h3 class="font-semibold text-zed-text-primary mb-4">
          Benefits of Hook Integration:
        </h3>
        <ul class="space-y-3 text-sm text-zed-text-secondary">
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span><strong>Instant notifications</strong> - Get notified immediately when agent needs input</span>
          </li>
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span><strong>100% accuracy</strong> - No false positives from pattern detection</span>
          </li>
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span><strong>Better workflow</strong> - Work on multiple lanes without constantly checking</span>
          </li>
        </ul>
      </div>

      {/* Comparison */}
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="bg-green-900/20 border border-green-700/30 p-4 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span class="font-semibold text-green-400">With Hooks</span>
          </div>
          <ul class="text-sm text-zed-text-secondary space-y-1">
            <li>• Instant notifications</li>
            <li>• 100% reliable detection</li>
            <li>• No delays</li>
          </ul>
        </div>

        <div class="bg-yellow-900/20 border border-yellow-700/30 p-4 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span class="font-semibold text-yellow-400">Without Hooks</span>
          </div>
          <ul class="text-sm text-zed-text-secondary space-y-1">
            <li>• 4-second delay</li>
            <li>• Pattern-based (less accurate)</li>
            <li>• May miss some prompts</li>
          </ul>
        </div>
      </div>

      {/* Toggle */}
      <div class="flex items-center justify-between p-4 bg-zed-bg-hover rounded-lg">
        <div>
          <label class="font-medium text-zed-text-primary">
            Enable hooks for {agentName}
          </label>
          <p class="text-sm text-zed-text-tertiary mt-1">
            You can change this later in Settings
          </p>
        </div>
        <button
          onClick={() => props.onDataChange({ hooksEnabled: !props.data.hooksEnabled })}
          class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            props.data.hooksEnabled ? 'bg-zed-accent-blue' : 'bg-zed-bg-active'
          }`}
        >
          <span
            class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              props.data.hooksEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Tutorial Content */}
      <details class="mt-6 bg-zed-bg-hover p-4 rounded-lg">
        <summary class="cursor-pointer font-semibold text-zed-text-primary flex items-center gap-2">
          <span>💡</span>
          <span>How do hooks work?</span>
        </summary>
        <p class="mt-3 text-sm text-zed-text-secondary pl-8">
          Hooks integrate directly with your agent's code to send real-time notifications
          to Codelane. When enabled, a small hook script is installed in your agent's
          configuration directory. This script notifies Codelane immediately when the
          agent prompts for input, completes a task, or encounters an error.
        </p>
      </details>
    </div>
  );
}
