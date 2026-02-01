// Agents Settings Tab

import { AgentSelector } from '../AgentSelector';
import type { AgentSettings } from '../../types/agent';

interface AgentsSettingsProps {
  settings: AgentSettings;
  onSettingsChange: (fn: (s: AgentSettings | null) => AgentSettings | null) => void;
  onValidationChange: (valid: boolean) => void;
}

export function AgentsSettings(props: AgentsSettingsProps) {
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
      </div>
    </div>
  );
}
