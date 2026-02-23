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
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

export function CodeReviewSettings() {
  const settings = codeReviewSettingsManager.getSettings();

  const [reviewModel, setReviewModel] = createSignal<string>(settings().reviewModel || '');
  const [reviewPrompt, setReviewPrompt] = createSignal<string>(settings().reviewPrompt);
  const [filePrompt, setFilePrompt] = createSignal<string>(settings().filePrompt);
  const [testStatus, setTestStatus] = createSignal<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = createSignal<string | null>(null);
  const [errorType, setErrorType] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const handleModelChange = (value: string) => {
    setReviewModel(value);
    codeReviewSettingsManager.setReviewModel(value.trim() || null);
    // Reset test status when model changes
    setTestStatus('idle');
    setTestError(null);
    setErrorType(null);
  };

  const handleTestModel = async () => {
    setTestStatus('testing');
    setTestError(null);
    setErrorType(null);

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
        setErrorType(result.errorType || 'unknown');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
      setErrorType('unknown');
    }
  };

  const handleCopyError = async () => {
    const error = testError();
    if (error) {
      await writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div class="space-y-3">
        <label class="block text-sm font-medium text-zed-text-primary">Model Override</label>
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
            class="px-4 py-2 text-sm rounded-md bg-zed-bg-hover border border-zed-border-default text-zed-text-primary hover:bg-zed-bg-active disabled:opacity-50 transition-colors whitespace-nowrap font-medium"
          >
            {testStatus() === 'testing' ? 'Testing...' : 'Test Model'}
          </button>
        </div>

        <div class="space-y-3">
          <Show when={testStatus() === 'success'}>
            <div class="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 p-2 rounded border border-green-400/20">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Model is valid and working correctly</span>
            </div>
          </Show>

          <Show when={testStatus() === 'error'}>
            <div class="space-y-2">
              <div class="flex flex-col gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-md">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 text-xs font-medium text-red-400">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {errorType() === 'model_not_found' ? 'Model Not Found' : 
                       errorType() === 'tool_not_found' ? 'CLI Tool Not Found' :
                       'Validation Failed'}
                    </span>
                  </div>
                  <button 
                    onClick={handleCopyError}
                    class="text-[10px] uppercase tracking-wider font-bold text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
                  >
                    {copied() ? 'Copied' : 'Copy Error'}
                  </button>
                </div>
                
                <div class="max-h-32 overflow-y-auto bg-black/20 p-2 rounded text-[11px] font-mono text-red-300/80 break-all whitespace-pre-wrap leading-relaxed">
                  {testError()}
                </div>

                <Show when={errorType() === 'model_not_found'}>
                  <p class="text-[11px] text-zed-text-tertiary">
                    Tip: Ensure the model name is correct for your CLI tool. For Gemini CLI, use names like <code class="text-zed-text-secondary">gemini-2.0-flash</code> or <code class="text-zed-text-secondary">gemini-1.5-pro</code>.
                  </p>
                </Show>
              </div>
            </div>
          </Show>

          <Show when={testStatus() === 'idle'}>
            <p class="text-xs text-zed-text-tertiary leading-relaxed">
              Leave empty to use the tool's default model. Example overrides: <code class="px-1 py-0.5 bg-zed-bg-panel rounded text-zed-text-secondary">sonnet</code>, <code class="px-1 py-0.5 bg-zed-bg-panel rounded text-zed-text-secondary">gpt-4o</code>, <code class="px-1 py-0.5 bg-zed-bg-panel rounded text-zed-text-secondary">gemini-2.0-flash</code>. Click "Test Model" to verify your settings.
            </p>
          </Show>
        </div>
      </div>

      <hr class="border-zed-border-subtle" />

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
        <p class="text-xs text-zed-text-tertiary mt-1.5">
          This prompt is sent along with the code diffs to generate the review summary.
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
        <p class="text-xs text-zed-text-tertiary mt-1.5">
          This prompt is used to generate feedback for each individual file.
        </p>
      </div>
    </div>
  );
}
