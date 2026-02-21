/**
 * CodeReviewSettings - Settings page for Code Review tab
 *
 * Configures: model override, review prompt, per-file feedback prompt.
 * The AI tool is derived from the main agent configured in the Agents tab.
 */

import { createSignal, Show } from 'solid-js';
import { aiReviewService } from '../../services/AIReviewService';
import { codeReviewSettingsManager, DEFAULT_REVIEW_PROMPT, DEFAULT_FILE_PROMPT } from '../../services/CodeReviewSettingsManager';
import { getReviewTool } from '../../lib/settings-api';

export function CodeReviewSettings() {
  const settings = codeReviewSettingsManager.getSettings();

  const [reviewModel, setReviewModel] = createSignal<string>(settings().reviewModel || '');
  const [reviewPrompt, setReviewPrompt] = createSignal<string>(settings().reviewPrompt);
  const [filePrompt, setFilePrompt] = createSignal<string>(settings().filePrompt);
  const [testStatus, setTestStatus] = createSignal<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = createSignal<string | null>(null);

  const handleModelChange = (value: string) => {
    setReviewModel(value);
    codeReviewSettingsManager.setReviewModel(value.trim() || null);
    // Reset test status when model changes
    setTestStatus('idle');
    setTestError(null);
  };

  const handleTestModel = async () => {
    setTestStatus('testing');
    setTestError(null);

    try {
      const tool = await getReviewTool();
      const model = reviewModel().trim() || undefined;

      // Run a minimal review to validate the model
      const result = await aiReviewService.generateReview({
        tool,
        diffContent: '+ hello world',
        workingDir: '.',
        customPrompt: 'Reply with just "ok".',
        model,
      });

      if (result.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(result.error || 'Model returned an error');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleReviewPromptChange = (value: string) => {
    setReviewPrompt(value);
    codeReviewSettingsManager.setReviewPrompt(value);
  };

  const handleFilePromptChange = (value: string) => {
    setFilePrompt(value);
    codeReviewSettingsManager.setFilePrompt(value);
  };

  const resetReviewPrompt = () => {
    setReviewPrompt(DEFAULT_REVIEW_PROMPT);
    codeReviewSettingsManager.setReviewPrompt(DEFAULT_REVIEW_PROMPT);
  };

  const resetFilePrompt = () => {
    setFilePrompt(DEFAULT_FILE_PROMPT);
    codeReviewSettingsManager.setFilePrompt(DEFAULT_FILE_PROMPT);
  };

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-zed-text-primary mb-1">Code Review</h2>
        <p class="text-sm text-zed-text-secondary">
          Configure the model and prompts used for code review generation. The AI tool used matches your default agent from the Agents tab.
        </p>
      </div>

      {/* Model Override */}
      <div>
        <label class="block text-sm font-medium text-zed-text-primary mb-2">Model</label>
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={reviewModel()}
            onInput={(e) => handleModelChange(e.currentTarget.value)}
            placeholder="Default (tool decides)"
            class="flex-1 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-sm text-zed-text-primary placeholder:text-zed-text-disabled focus:outline-none focus:border-zed-accent-blue"
          />
          <button
            onClick={handleTestModel}
            disabled={testStatus() === 'testing'}
            class="px-3 py-2 text-sm rounded-md bg-zed-bg-hover border border-zed-border-default text-zed-text-primary hover:bg-zed-bg-active disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {testStatus() === 'testing' ? 'Testing...' : 'Test'}
          </button>
        </div>
        <div class="mt-1.5 flex items-center gap-1.5">
          <Show when={testStatus() === 'success'}>
            <span class="text-xs text-green-400">Model is valid</span>
          </Show>
          <Show when={testStatus() === 'error'}>
            <span class="text-xs text-zed-accent-red">{testError() || 'Invalid model'}</span>
          </Show>
          <Show when={testStatus() === 'idle'}>
            <p class="text-xs text-zed-text-tertiary">
              Leave empty to use the tool's default model. Examples: <code class="px-1 py-0.5 bg-zed-bg-panel rounded">sonnet</code>, <code class="px-1 py-0.5 bg-zed-bg-panel rounded">gpt-4o</code>, <code class="px-1 py-0.5 bg-zed-bg-panel rounded">gemini-2.0-flash</code>
            </p>
          </Show>
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
          class="w-full h-32 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-sm text-zed-text-primary resize-y focus:outline-none focus:border-zed-accent-blue"
        />
        <p class="text-xs text-zed-text-tertiary mt-1">
          This prompt is sent along with the code diffs to generate the review summary. Use "Reset to Default" to restore the built-in prompt.
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
          class="w-full h-24 px-3 py-2 bg-zed-bg-app border border-zed-border-default rounded-md text-sm text-zed-text-primary resize-y focus:outline-none focus:border-zed-accent-blue"
        />
        <p class="text-xs text-zed-text-tertiary mt-1">
          This prompt is used to generate feedback for each individual file. Use "Reset to Default" to restore the built-in prompt.
        </p>
      </div>
    </div>
  );
}
