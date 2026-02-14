// Main Settings Dialog - Shell that orchestrates settings pages

import { createSignal, createEffect, Show, For } from 'solid-js';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { Button } from '../ui/Button';
import { getAgentSettings, updateAgentSettings } from '../../lib/settings-api';
import type { AgentSettings } from '../../types/agent';

// Import settings page components
import { GeneralSettings } from './GeneralSettings';
import { AgentsSettings } from './AgentsSettings';
import { NotificationSettings } from './NotificationSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { CodeReviewSettings } from './CodeReviewSettings';
import { SettingsNavIcon } from './SettingsNavIcon';
import { NAV_ITEMS, type SettingsTab } from './types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsSaved: (settings: AgentSettings) => void;
}

export function SettingsDialog(props: SettingsDialogProps) {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>('agents');
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
    <KobalteDialog open={props.open} onOpenChange={handleOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content class="relative w-full max-w-4xl h-[600px] bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl flex overflow-hidden">
            {/* Left Sidebar */}
            <div class="w-56 bg-zed-bg-panel border-r border-zed-border-default flex flex-col">
              {/* Header */}
              <div class="p-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-zed-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="text-lg font-semibold text-zed-text-primary">Settings</span>
              </div>

              {/* Navigation */}
              <nav class="flex-1 px-2 py-2">
                <For each={NAV_ITEMS}>
                  {(item) => (
                    <button
                      class={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab() === item.id
                          ? 'bg-zed-accent-blue/20 text-zed-accent-blue border-l-2 border-zed-accent-blue -ml-0.5 pl-[14px]'
                          : 'text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover'
                      }`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <SettingsNavIcon icon={item.icon} class="w-5 h-5" />
                      {item.label}
                    </button>
                  )}
                </For>
              </nav>

              {/* Version */}
              <div class="p-4 text-xs text-zed-text-disabled">
                Codelane Desktop v0.1.0
              </div>
            </div>

            {/* Right Content */}
            <div class="flex-1 flex flex-col">
              {/* Content Area */}
              <div class="flex-1 overflow-auto p-6">
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
                    <Button variant="secondary" size="sm" onClick={loadSettings}>
                      Retry
                    </Button>
                  </div>
                </Show>

                {/* Tab Content */}
                <Show when={!isLoading() && !error()}>
                  {/* General Tab */}
                  <Show when={activeTab() === 'general'}>
                    <GeneralSettings />
                  </Show>

                  {/* Agents Tab */}
                  <Show when={activeTab() === 'agents' && settings()}>
                    <AgentsSettings
                      settings={settings()!}
                      onSettingsChange={setSettings}
                      onValidationChange={setIsAgentValid}
                    />
                  </Show>

                  {/* Code Review Tab */}
                  <Show when={activeTab() === 'code-review'}>
                    <CodeReviewSettings />
                  </Show>

                  {/* Notifications Tab */}
                  <Show when={activeTab() === 'notifications'}>
                    <NotificationSettings />
                  </Show>

                  {/* Appearance Tab */}
                  <Show when={activeTab() === 'appearance'}>
                    <AppearanceSettings />
                  </Show>
                </Show>
              </div>

              {/* Footer */}
              <div class="px-6 py-4 border-t border-zed-border-default flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={handleCancel} disabled={isSaving()}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={isSaving() || !isAgentValid()}
                >
                  {isSaving() ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>

            {/* Close Button */}
            <KobalteDialog.CloseButton class="absolute top-4 right-4 rounded-md p-1 hover:bg-zed-bg-hover transition-colors">
              <svg class="h-5 w-5 text-zed-text-tertiary hover:text-zed-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </KobalteDialog.CloseButton>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
