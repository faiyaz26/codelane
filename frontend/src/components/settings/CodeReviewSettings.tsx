/**
 * CodeReviewSettings - Settings page for Code Review tab
 *
 * Configures: AI tool, model, review prompt, per-file feedback prompt.
 */

import { createSignal, createEffect, For, Show } from 'solid-js';
import { AI_MODELS, type AITool } from '../../services/AIReviewService';
import { aiReviewService } from '../../services/AIReviewService';
import { codeReviewSettingsManager, type CodeReviewSettings as Settings } from '../../services/CodeReviewSettingsManager';

const AI_TOOLS: Array<{ value: AITool; label: string }> = [
  { value: 'claude', label: 'Claude' },
  { value: 'aider', label: 'Aider' },
  { value: 'opencode', label: 'OpenCode' },
  { value: 'gemini', label: 'Gemini' },
];

export function CodeReviewSettings() {
  const settings = codeReviewSettingsManager.getSettings();

  const [selectedTool, setSelectedTool] = createSignal<AITool>(settings().aiTool);
  const [selectedModel, setSelectedModel] = createSignal<string>(settings().aiModel[settings().aiTool]);
  const [reviewPrompt, setReviewPrompt] = createSignal<string>(settings().reviewPrompt || '');
  const [filePrompt, setFilePrompt] = createSignal<string>(settings().filePrompt || '');

  // Update model when tool changes
  createEffect(() => {
    const tool = selectedTool();
    const savedModel = settings().aiModel[tool];
    setSelectedModel(savedModel);
  });

  const handleToolChange = (tool: AITool) => {
    setSelectedTool(tool);
    codeReviewSettingsManager.setAITool(tool);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    codeReviewSettingsManager.setAIModel(selectedTool(), model);
  };

  const handleReviewPromptChange = (value: string) => {
    setReviewPrompt(value);
    codeReviewSettingsManager.setReviewPrompt(value.trim() || null);
  };

  const handleFilePromptChange = (value: string) => {
    setFilePrompt(value);
    codeReviewSettingsManager.setFilePrompt(value.trim() || null);
  };

  const resetReviewPrompt = () => {
    setReviewPrompt('');
    codeReviewSettingsManager.setReviewPrompt(null);
  };

  const resetFilePrompt = () => {
    setFilePrompt('');
    codeReviewSettingsManager.setFilePrompt(null);
  };

  const availableModels = () => AI_MODELS[selectedTool()] || [];

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-zed-text-primary mb-1">Code Review</h2>
        <p class="text-sm text-zed-text-secondary">
          Configure the AI tool and prompts used for code review generation.
        </p>
      </div>

      {/* AI Tool Selection */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">AI Tool</label>
        <div class="flex gap-2">
          <For each={AI_TOOLS}>
            {(tool) => (
              <button
                onClick={() => handleToolChange(tool.value)}
                class={`px-4 py-2 text-sm rounded-md transition-colors ${
                  selectedTool() === tool.value
                    ? 'bg-zed-accent-blue text-white'
                    : 'bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-active'
                }`}
              >
                {tool.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* AI Model Selection */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">Model</label>
        <div class="flex flex-col gap-1.5">
          <For each={availableModels()}>
            {(model) => (
              <button
                onClick={() => handleModelChange(model.value)}
                class={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  selectedModel() === model.value
                    ? 'bg-zed-accent-blue/20 text-zed-accent-blue border border-zed-accent-blue/30'
                    : 'bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary border border-transparent'
                }`}
              >
                <div>
                  <div class="font-medium">{model.label}</div>
                  <div class="text-xs opacity-70">{model.description}</div>
                </div>
                <Show when={selectedModel() === model.value}>
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Review Prompt */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-medium text-zed-text-primary">Review Summary Prompt</label>
          <button
            onClick={resetReviewPrompt}
            class="text-xs text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
          >
            Reset to Default
          </button>
        </div>
        <textarea
          value={reviewPrompt()}
          onInput={(e) => handleReviewPromptChange(e.currentTarget.value)}
          placeholder={aiReviewService.getEnhancedReviewPrompt()}
          class="w-full h-32 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-sm text-zed-text-primary placeholder:text-zed-text-disabled resize-y focus:outline-none focus:border-zed-accent-blue"
        />
        <p class="text-xs text-zed-text-tertiary mt-1">
          Leave empty to use the default prompt. This prompt is sent along with the code diffs to generate the review summary.
        </p>
      </div>

      {/* Per-File Feedback Prompt */}
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-sm font-medium text-zed-text-primary">Per-File Feedback Prompt</label>
          <button
            onClick={resetFilePrompt}
            class="text-xs text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
          >
            Reset to Default
          </button>
        </div>
        <textarea
          value={filePrompt()}
          onInput={(e) => handleFilePromptChange(e.currentTarget.value)}
          placeholder={aiReviewService.getDefaultFilePrompt()}
          class="w-full h-24 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-sm text-zed-text-primary placeholder:text-zed-text-disabled resize-y focus:outline-none focus:border-zed-accent-blue"
        />
        <p class="text-xs text-zed-text-tertiary mt-1">
          Leave empty to use the default prompt. This prompt is used to generate feedback for each individual file.
        </p>
      </div>
    </div>
  );
}
