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
      <div class="mt-4 p-3 bg-zed-bg-app border border-zed-border-subtle rounded-md">
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-xs font-semibold text-zed-text-primary uppercase tracking-wider">Settings</h4>
          <Show when={saving() || saveMessage()}>
            <span class="text-[10px] text-green-400">{saving() ? 'Saving...' : saveMessage()}</span>
          </Show>
        </div>
        
        <div class="space-y-3">
          <For each={definition()!.schemas}>
            {(schema) => (
              <div class="flex flex-col gap-1">
                <label class="text-xs text-zed-text-secondary font-medium">
                  {schema.title}
                </label>
                <Show when={schema.description}>
                  <span class="text-[10px] text-zed-text-tertiary mb-1">{schema.description}</span>
                </Show>

                {schema.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={settings()?.[schema.id] || false}
                    onChange={(e) => handleChange(schema.id, e.currentTarget.checked)}
                    class="accent-zed-accent-blue w-4 h-4"
                  />
                )}

                {(schema.type === 'string' || schema.type === 'number') && (
                  <input
                    type={schema.type === 'number' ? 'number' : 'text'}
                    value={settings()?.[schema.id] ?? ''}
                    onInput={(e) => handleChange(schema.id, schema.type === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value)}
                    class="bg-zed-bg-panel border border-zed-border-default rounded px-2 py-1 text-xs text-zed-text-primary focus:border-zed-accent-blue focus:outline-none transition-colors"
                  />
                )}

                {schema.type === 'select' && schema.options && (
                  <select
                    value={settings()?.[schema.id] ?? ''}
                    onChange={(e) => handleChange(schema.id, e.currentTarget.value)}
                    class="bg-zed-bg-panel border border-zed-border-default rounded px-2 py-1 text-xs text-zed-text-primary focus:border-zed-accent-blue focus:outline-none transition-colors"
                  >
                    <For each={schema.options}>
                      {(opt) => (
                        <option value={opt.value}>{opt.label}</option>
                      )}
                    </For>
                  </select>
                )}
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}