import { createSignal, createResource, For, Show } from 'solid-js';
import { extensionSettingsManager } from '../../services/ExtensionSettingsManager';

interface Props {
  extensionId: string;
}

export function ExtensionSettingsForm(props: Props) {
  const definition = () => extensionSettingsManager.getDefinition(props.extensionId);
  
  const [settings, { mutate }] = createResource(
    () => props.extensionId,
    (id) => extensionSettingsManager.loadSettings(id)
  );

  const [saving, setSaving] = createSignal(false);
  const [saveMessage, setSaveMessage] = createSignal('');

  const handleChange = async (key: string, value: any) => {
    if (!settings()) return;
    const newSettings = { ...settings()!, [key]: value };
    mutate(newSettings);
    
    setSaving(true);
    await extensionSettingsManager.saveSettings(props.extensionId, newSettings);
    setSaving(false);
    
    setSaveMessage('Saved');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  return (
    <Show when={definition() && definition()!.schemas.length > 0}>
      <div class="space-y-6">
        <For each={definition()!.schemas}>
          {(schema) => (
            <div class="flex flex-col gap-1.5 max-w-2xl">
              <div class="flex justify-between items-center">
                <label class="text-sm text-zed-text-primary font-medium">
                  {schema.title}
                </label>
                <Show when={saving() && schema.id === 'saving-id-placeholder' /* logic for per-field saving indicator if needed */}>
                   <span class="text-[10px] text-green-400">Saving...</span>
                </Show>
              </div>
              
              <Show when={schema.description}>
                <p class="text-xs text-zed-text-tertiary leading-relaxed">{schema.description}</p>
              </Show>

              <div class="mt-1">
                {schema.type === 'boolean' && (
                  <div class="flex items-center h-8">
                    <input
                      type="checkbox"
                      checked={settings()?.[schema.id] || false}
                      onChange={(e) => handleChange(schema.id, e.currentTarget.checked)}
                      class="accent-zed-accent-blue w-4 h-4 cursor-pointer"
                    />
                  </div>
                )}

                {(schema.type === 'string' || schema.type === 'number') && (
                  <input
                    type={schema.type === 'number' ? 'number' : 'text'}
                    value={settings()?.[schema.id] ?? ''}
                    onInput={(e) => handleChange(schema.id, schema.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
                    class="w-full bg-zed-bg-surface border border-zed-border-default rounded px-3 py-1.5 text-sm text-zed-text-primary focus:border-zed-accent-blue focus:ring-1 focus:ring-zed-accent-blue focus:outline-none transition-all"
                  />
                )}

                {schema.type === 'select' && schema.options && (
                  <div class="relative">
                    <select
                      value={settings()?.[schema.id] ?? ''}
                      onChange={(e) => handleChange(schema.id, e.currentTarget.value)}
                      class="w-full bg-zed-bg-surface border border-zed-border-default rounded px-3 py-1.5 text-sm text-zed-text-primary focus:border-zed-accent-blue focus:ring-1 focus:ring-zed-accent-blue focus:outline-none transition-all cursor-pointer appearance-none"
                    >
                      <For each={schema.options}>
                        {(opt) => (
                          <option value={opt.value}>{opt.label}</option>
                        )}
                      </For>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zed-text-tertiary">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </For>
        
        <Show when={saveMessage()}>
          <div class="fixed bottom-20 right-10 bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in-out text-sm font-medium">
            Settings saved successfully
          </div>
        </Show>
      </div>
    </Show>
  );
}