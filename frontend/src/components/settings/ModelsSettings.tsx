// Models Settings Tab

import { createSignal, For, Show } from 'solid-js';

export function ModelsSettings() {
  const [selectedModel, setSelectedModel] = createSignal('gpt-4o');
  const [temperature, setTemperature] = createSignal(0.7);
  const [topP, setTopP] = createSignal(1.0);
  const [maxTokens, setMaxTokens] = createSignal(4096);

  const models = [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'High intelligence, fast reasoning' },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Excellent coding capabilities' },
    { id: 'llama-3-70b', name: 'Llama 3 (70B)', description: 'Open source performance' },
  ];

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Model Configuration</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Configure the default AI models and generation parameters for your agents.
      </p>

      <div class="space-y-6">
        {/* Preferred Model */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-3">Preferred Model</h3>
          <div class="flex gap-3">
            <For each={models}>
              {(model) => (
                <button
                  class={`flex-1 p-4 rounded-lg border text-left transition-all ${
                    selectedModel() === model.id
                      ? 'border-zed-accent-blue bg-zed-accent-blue/10'
                      : 'border-zed-border-default bg-zed-bg-surface hover:border-zed-border-focus'
                  }`}
                  onClick={() => setSelectedModel(model.id)}
                >
                  <div class="flex items-start justify-between mb-1">
                    <span class={`text-sm font-medium ${selectedModel() === model.id ? 'text-zed-accent-blue' : 'text-zed-text-primary'}`}>
                      {model.name}
                    </span>
                    <Show when={selectedModel() === model.id}>
                      <svg class="w-4 h-4 text-zed-accent-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </Show>
                  </div>
                  <p class="text-xs text-zed-text-tertiary">{model.description}</p>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-zed-text-primary">Temperature</h3>
            <span class="text-sm text-zed-accent-blue font-medium">{temperature().toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature()}
            onInput={(e) => setTemperature(parseFloat(e.currentTarget.value))}
            class="w-full h-1.5 bg-zed-bg-surface rounded-full appearance-none cursor-pointer accent-zed-accent-blue"
          />
          <p class="text-xs text-zed-text-tertiary mt-2">
            Higher values make output more random, lower values more deterministic.
          </p>
        </div>

        {/* Top P */}
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-zed-text-primary">Top P</h3>
            <span class="text-sm text-zed-accent-blue font-medium">{topP().toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={topP()}
            onInput={(e) => setTopP(parseFloat(e.currentTarget.value))}
            class="w-full h-1.5 bg-zed-bg-surface rounded-full appearance-none cursor-pointer accent-zed-accent-blue"
          />
          <p class="text-xs text-zed-text-tertiary mt-2">
            Nucleus sampling: only consider tokens with top_p probability mass.
          </p>
        </div>

        {/* Maximum Tokens */}
        <div>
          <div class="flex items-center justify-between mb-2">
            <div>
              <h3 class="text-sm font-medium text-zed-text-primary">Maximum Tokens</h3>
              <p class="text-xs text-zed-text-tertiary mt-1">
                The maximum number of tokens to generate in a response.
              </p>
            </div>
            <input
              type="number"
              value={maxTokens()}
              onInput={(e) => setMaxTokens(parseInt(e.currentTarget.value) || 0)}
              class="w-24 px-3 py-1.5 text-sm bg-zed-bg-surface border border-zed-border-default rounded-md text-zed-text-primary text-right focus:outline-none focus:border-zed-accent-blue"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
