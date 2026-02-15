/**
 * CodeReviewLayout - Top-level component for the Code Review tab
 *
 * Replaces the editor area when Code Review is active.
 * Manages states: idle → loading → ready → error
 * In ready state: horizontal split with ReviewSummaryPanel (left) and ReviewChangesPanel (right)
 */

import { createSignal, createEffect, Show } from 'solid-js';
import { ReviewSummaryPanel } from './ReviewSummaryPanel';
import { ReviewChangesPanel } from './ReviewChangesPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { codeReviewSettingsManager } from '../../services/CodeReviewSettingsManager';
import { useGitService } from '../../hooks/useGitService';

interface CodeReviewLayoutProps {
  laneId: string;
  workingDir: string;
}

// Min/max widths for the left panel (summary)
const LEFT_PANEL_MIN_WIDTH = 250;
const LEFT_PANEL_MAX_WIDTH_RATIO = 0.6; // 60% of container

export function CodeReviewLayout(props: CodeReviewLayoutProps) {
  const [leftPanelWidth, setLeftPanelWidth] = createSignal(400);

  const reviewState = () => codeReviewStore.getState(props.laneId)();

  // Watch for git changes
  const gitWatcher = useGitService({
    laneId: () => props.laneId,
    workingDir: () => props.workingDir,
  });

  const hasChanges = () => gitWatcher.hasChanges();

  const handleGenerate = () => {
    codeReviewStore.generateReview(props.laneId, props.workingDir);
  };

  const handleRegenerate = () => {
    codeReviewStore.reset(props.laneId);
    codeReviewStore.generateReview(props.laneId, props.workingDir);
  };

  const handleVisibleFileChange = (path: string) => {
    codeReviewStore.setVisibleFile(props.laneId, path);
  };

  const handleLeftPanelResize = (delta: number) => {
    const containerWidth = document.getElementById('code-review-layout')?.clientWidth || 800;
    const maxWidth = containerWidth * LEFT_PANEL_MAX_WIDTH_RATIO;
    const newWidth = Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(maxWidth, leftPanelWidth() + delta));
    setLeftPanelWidth(newWidth);
  };

  const toolName = () => codeReviewSettingsManager.getAITool();

  return (
    <div id="code-review-layout" class="flex-1 flex flex-col overflow-hidden">
      {/* Idle State */}
      <Show when={reviewState().status === 'idle'}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app">
          <svg class="w-20 h-20 mb-6 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 14l2 2 4-4" />
          </svg>
          <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Code Review</h2>
          <p class="text-sm text-zed-text-secondary mb-6 max-w-md">
            Generate an AI-powered summary and review of your uncommitted changes.
            Each file will be analyzed for quality, bugs, and improvements.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!hasChanges()}
            class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {hasChanges() ? 'Generate AI Summary & Review' : 'No Changes to Review'}
          </button>
          <Show when={hasChanges()}>
            <p class="text-xs text-zed-text-tertiary mt-3">
              Using <span class="text-zed-text-secondary font-medium">{toolName()}</span>
            </p>
          </Show>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={reviewState().status === 'loading'}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app">
          <div class="w-12 h-12 mb-6 relative">
            <div class="absolute inset-0 border-2 border-zed-border-subtle rounded-full" />
            <div class="absolute inset-0 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <h3 class="text-lg font-medium text-zed-text-primary mb-2">Generating Review</h3>
          <p class="text-sm text-zed-text-secondary">
            {reviewState().loadingProgress || 'Analyzing your changes...'}
          </p>
        </div>
      </Show>

      {/* Error State */}
      <Show when={reviewState().status === 'error'}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app">
          <svg class="w-16 h-16 mb-4 text-red-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 class="text-lg font-medium text-zed-text-primary mb-2">Review Failed</h3>
          <p class="text-sm text-red-400 mb-4 max-w-md">{reviewState().error}</p>
          <div class="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => codeReviewStore.reset(props.laneId)}
              class="px-4 py-2 bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary rounded-md transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Ready State - Two-pane layout */}
      <Show when={reviewState().status === 'ready'}>
        <div class="flex-1 flex overflow-hidden">
          {/* Left: AI Summary */}
          <div class="flex-shrink-0 overflow-hidden" style={{ width: `${leftPanelWidth()}px` }}>
            <ReviewSummaryPanel
              markdown={reviewState().reviewMarkdown || ''}
              generatedAt={reviewState().generatedAt}
              isLoading={false}
              onRegenerate={handleRegenerate}
            />
          </div>

          {/* Resize Handle */}
          <ResizeHandle direction="left" onResize={handleLeftPanelResize} />

          {/* Right: Changes + Context */}
          <div class="flex-1 overflow-hidden min-w-0">
            <ReviewChangesPanel
              laneId={props.laneId}
              workingDir={props.workingDir}
              sortedFiles={reviewState().sortedFiles}
              fileDiffs={reviewState().fileDiffs}
              perFileFeedback={reviewState().perFileFeedback}
              visibleFilePath={reviewState().visibleFilePath}
              scrollToPath={reviewState().scrollToPath}
              onVisibleFileChange={handleVisibleFileChange}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}

/**
 * Expose a way for the sidebar to trigger scroll-to-file.
 * This is accessed via the CodeReviewLayout's scrollToFile ref.
 */
export function useCodeReviewScrollToFile(): {
  setScrollFn: (fn: (path: string) => void) => void;
  scrollToFile: (path: string) => void;
} {
  let fn: ((path: string) => void) | null = null;
  return {
    setScrollFn: (f) => { fn = f; },
    scrollToFile: (path) => { fn?.(path); },
  };
}
