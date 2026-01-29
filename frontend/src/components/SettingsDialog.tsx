import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { AgentSelector } from './AgentSelector';
import { getAgentSettings, updateAgentSettings } from '../lib/settings-api';
import type { AgentSettings } from '../types/agent';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved: (settings: AgentSettings) => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [settings, setSettings] = createSignal<AgentSettings | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [isAgentValid, setIsAgentValid] = createSignal(true);

  // Load settings when dialog opens
  createEffect(() => {
    if (props.open) {
      loadSettings();
    }
  });

  // Load settings when dialog opens
  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getAgentSettings();
      setSettings(loaded);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Load settings when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      loadSettings();
    }
    props.onOpenChange(open);
  };

  const handleSave = async () => {
    const currentSettings = settings();
    if (!currentSettings) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateAgentSettings(currentSettings);
      props.onSettingsSaved(currentSettings);
      props.onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(null);
    setError(null);
    props.onOpenChange(false);
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title="Settings"
      description="Configure global agent settings for Codelane."
    >
      <div class="space-y-6">
        {/* Loading State */}
        <Show when={isLoading()}>
          <div class="text-center py-8 text-zed-text-secondary">
            Loading settings...
          </div>
        </Show>

        {/* Error State */}
        <Show when={!isLoading() && error()}>
          <div class="p-4 rounded-md bg-zed-accent-red/10 border border-zed-accent-red/30">
            <p class="font-semibold text-zed-accent-red mb-2">Error loading settings</p>
            <p class="text-sm text-zed-accent-red mb-3">{error()}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadSettings}
            >
              Retry
            </Button>
          </div>
        </Show>

        {/* Settings Form */}
        <Show when={!isLoading() && !error() && settings()}>
          <div class="space-y-6">
            {/* Default Agent Section */}
            <div>
              <h3 class="text-base font-semibold text-zed-text-primary mb-4">
                Default Agent
              </h3>
              <p class="text-sm text-zed-text-secondary mb-4">
                The default agent used when creating new lanes. Individual lanes can override this setting.
              </p>
              <AgentSelector
                value={settings()!.defaultAgent}
                onChange={(config) => setSettings((s) => s ? { ...s, defaultAgent: config } : null)}
                presets={settings()!.presets}
                onValidationChange={setIsAgentValid}
              />
            </div>

            {/* Info about per-lane overrides */}
            <div class="p-4 bg-zed-bg-surface rounded-md border border-zed-border-default">
              <div class="flex gap-3">
                <svg
                  class="w-5 h-5 text-zed-accent-blue flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 class="text-sm font-medium text-zed-text-primary mb-1">
                    Per-Lane Agent Overrides
                  </h4>
                  <p class="text-xs text-zed-text-secondary">
                    Individual lanes can override the default agent. Use this when different projects need different agents (e.g., one project uses Claude Code while another uses Aider).
                  </p>
                </div>
              </div>
            </div>


            {/* Save Error Display */}
            <Show when={error()}>
              <div class="p-3 rounded-md bg-zed-accent-red/10 border border-zed-accent-red/30 text-sm text-zed-accent-red">
                {error()}
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex justify-end gap-2 pt-4 border-t border-zed-border-default">
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={isSaving()}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving() || !isAgentValid()}
              >
                {isSaving() ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </Show>
      </div>
    </Dialog>
  );
}
