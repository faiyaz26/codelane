/**
 * CodeReviewLayout - Top-level component for the Code Review tab
 *
 * Replaces the editor area when Code Review is active.
 * Manages states: idle → loading → ready → error
 * In ready state: horizontal split with ReviewSummaryPanel (left) and ReviewChangesPanel (right)
 */

import { createSignal, createEffect, Show, onCleanup, createMemo } from 'solid-js';
import { ReviewSummaryPanel } from './ReviewSummaryPanel';
import { ReviewChangesPanel } from './ReviewChangesPanel';
import { ResizeHandle } from '../layout/ResizeHandle';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { codeReviewSettingsManager } from '../../services/CodeReviewSettingsManager';
import { useGitService } from '../../hooks/useGitService';
import { useReviewKeyboardShortcuts } from '../../hooks/useReviewKeyboardShortcuts';
import { computeChangesetChecksum, checksumsMatch } from '../../utils/changesetChecksum';

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

  // Memoize derived state to stabilize reactive values used in Show conditions
  // Impact: Reduces number of comparisons and prevents unnecessary Show/condition reevaluations
  const hasChanges = createMemo(() => gitWatcher.hasChanges());

  // Memoize status checks used in multiple conditions throughout render
  // Impact: Avoids rechecking status string multiple times in Show conditions (lines 72, 103, 164, 189)
  const isIdle = createMemo(() => reviewState().status === 'idle');
  const isReady = createMemo(() => reviewState().status === 'ready');
  const isError = createMemo(() => reviewState().status === 'error');
  const isGenerating = createMemo(() => {
    const status = reviewState().status;
    return status !== 'idle' && status !== 'ready' && status !== 'error';
  });

  // Memoize AI tool name for stable reference in multiple renders
  const toolName = createMemo(() => codeReviewSettingsManager.getAITool());

  // Detect if review is stale (changes committed/stashed or new changes)
  const reviewStatus = createMemo(() => {
    const state = reviewState();
    const hasChanges = gitWatcher.hasChanges();

    // Not ready yet - no staleness to check
    if (state.status !== 'ready') {
      return { type: 'current' as const };
    }

    // Changes were committed/stashed after review
    if (!hasChanges) {
      return { type: 'committed' as const };
    }

    // Check if current changeset differs from reviewed changeset using checksum
    const gitStatus = gitWatcher.gitStatus();

    // If gitStatus hasn't loaded yet, assume current (don't show false positive)
    if (!gitStatus || !gitStatus.changesWithStats) {
      return { type: 'current' as const };
    }

    const currentFiles = gitStatus.changesWithStats;
    const currentChecksum = computeChangesetChecksum(currentFiles);
    const reviewedChecksum = state.changesetChecksum;

    // If checksums don't match, review is stale
    if (!checksumsMatch(currentChecksum, reviewedChecksum)) {
      return { type: 'stale' as const };
    }

    return { type: 'current' as const };
  });

  // Screen reader announcements
  const statusAnnouncement = createMemo(() => {
    const status = reviewState().status;
    const progress = reviewState().progress;

    switch (status) {
      case 'fetching-changes':
        return 'Fetching changed files';
      case 'fetching-diffs':
        return `Fetching diffs for ${progress.processedFiles} of ${progress.totalFiles} files`;
      case 'sorting-files':
        return 'Sorting files';
      case 'generating-summary':
        return 'Generating AI summary';
      case 'generating-file-feedback':
        return `Analyzing file ${progress.processedFiles} of ${progress.totalFiles}`;
      case 'ready':
        return 'Review complete';
      case 'error':
        return `Error: ${reviewState().error}`;
      default:
        return '';
    }
  });

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

  const handleNextFile = () => {
    const state = reviewState();
    if (state.status !== 'ready') return;

    const files = state.sortedFiles;
    const currentPath = state.visibleFilePath;

    if (!currentPath || files.length === 0) return;

    const currentIndex = files.findIndex(f => f.path === currentPath);
    if (currentIndex < files.length - 1) {
      codeReviewStore.requestScrollToFile(props.laneId, files[currentIndex + 1].path);
    }
  };

  const handlePrevFile = () => {
    const state = reviewState();
    if (state.status !== 'ready') return;

    const files = state.sortedFiles;
    const currentPath = state.visibleFilePath;

    if (!currentPath || files.length === 0) return;

    const currentIndex = files.findIndex(f => f.path === currentPath);
    if (currentIndex > 0) {
      codeReviewStore.requestScrollToFile(props.laneId, files[currentIndex - 1].path);
    }
  };

  const handleCancel = () => {
    const state = reviewState();
    if (state.status !== 'idle' && state.status !== 'ready' && state.status !== 'error') {
      codeReviewStore.cancelReview(props.laneId);
    }
  };

  // Keyboard shortcuts
  useReviewKeyboardShortcuts({
    onRegenerate: () => {
      if (reviewState().status === 'ready') {
        handleRegenerate();
      }
    },
    onCancel: handleCancel,
    onNextFile: handleNextFile,
    onPrevFile: handlePrevFile,
  });

  // Lightweight polling to detect changes when review is ready
  // Polls every 3 seconds to check for new/changed files
  createEffect(() => {
    const isReady = reviewState().status === 'ready';

    if (isReady) {
      const pollInterval = setInterval(async () => {
        // Explicitly refresh git status to detect new/changed files
        await gitWatcher.refresh();
      }, 3000); // Poll every 3 seconds

      onCleanup(() => clearInterval(pollInterval));
    }
  });

  // Cancel review if component unmounts during generation
  onCleanup(() => {
    const status = reviewState().status;
    if (status !== 'idle' && status !== 'ready' && status !== 'error') {
      codeReviewStore.cancelReview(props.laneId);
    }
  });

  return (
    <div id="code-review-layout" class="flex-1 flex flex-col overflow-hidden">
      {/* Screen reader live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {statusAnnouncement()}
      </div>

      {/* Skip link */}
      <a
        href="#main-review-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded"
      >
        Skip to review content
      </a>

      {/* Idle State */}
      <Show when={isIdle()}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app">
          <svg class="w-20 h-20 mb-6 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            aria-label={hasChanges() ? 'Generate AI Summary and Review' : 'No changes to review'}
            class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
      <Show when={isGenerating()}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app" role="status" aria-live="polite">
          <div class="w-16 h-16 mb-6 relative">
            <div class="absolute inset-0 border-3 border-zed-border-subtle rounded-full" />
            <div class="absolute inset-0 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
            {/* Inner pulse */}
            <div class="absolute inset-2 border-2 border-purple-500/30 rounded-full animate-pulse" />
          </div>
          <h3 class="text-lg font-medium text-zed-text-primary mb-2">Generating Review</h3>
          <p class="text-sm text-zed-text-secondary mb-2">
            {(() => {
              const progress = reviewState().progress;
              switch (progress.phase) {
                case 'fetching-changes':
                  return 'Fetching changes...';
                case 'fetching-diffs':
                  return `Fetching diffs... (${progress.processedFiles}/${progress.totalFiles} files)`;
                case 'sorting-files':
                  return 'Sorting files...';
                case 'generating-summary':
                  return 'Generating AI summary...';
                case 'generating-file-feedback':
                  return `Analyzing files... (${progress.processedFiles}/${progress.totalFiles} complete)`;
                default:
                  return 'Processing...';
              }
            })()}
          </p>
          <Show when={reviewState().progress.currentFile}>
            <p class="text-xs text-zed-text-tertiary mb-4 font-mono max-w-md truncate">
              {reviewState().progress.currentFile}
            </p>
          </Show>
          <Show when={reviewState().progress.phase === 'generating-file-feedback' && reviewState().progress.totalFiles > 0}>
            <div class="w-full max-w-md mb-4">
              <div class="h-1.5 bg-zed-border-subtle rounded-full overflow-hidden">
                <div
                  class="h-full bg-purple-500 transition-all duration-300"
                  style={{
                    width: `${(reviewState().progress.processedFiles / reviewState().progress.totalFiles) * 100}%`
                  }}
                />
              </div>
            </div>
          </Show>
          <div class="flex flex-col items-center gap-2 text-xs text-zed-text-tertiary">
            <p>Using <span class="text-zed-text-secondary font-medium">{toolName()}</span></p>
            <p class="max-w-md">This may take a few minutes for large changesets. The AI is analyzing each file for quality, bugs, and improvements.</p>
          </div>
          <button
            onClick={() => {
              codeReviewStore.cancelReview(props.laneId);
            }}
            aria-label="Cancel review generation"
            class="mt-4 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </Show>

      {/* Error State */}
      <Show when={isError()}>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zed-bg-app" role="alert">
          <svg class="w-16 h-16 mb-4 text-red-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 class="text-lg font-medium text-zed-text-primary mb-2">Review Failed</h3>
          <p class="text-sm text-red-400 mb-4 max-w-md">{reviewState().error}</p>
          <div class="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              aria-label="Retry review generation"
              class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
            >
              Retry
            </button>
            <button
              onClick={() => codeReviewStore.reset(props.laneId)}
              aria-label="Cancel and reset review"
              class="px-4 py-2 bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary rounded-md transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* Ready State - Two-pane layout */}
      <Show when={isReady()}>
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Warning: Changes Committed/Stashed */}
          <Show when={reviewStatus().type === 'committed'}>
            <div class="flex-shrink-0 px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/30 flex items-start gap-3">
              <svg class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16c-.77.833.192 3 1.732 3z" />
              </svg>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-yellow-400 mb-1">Changes Committed or Stashed</h4>
                <p class="text-xs text-zed-text-secondary">
                  The reviewed changes have been committed or stashed. This review is now outdated.
                </p>
              </div>
              <button
                onClick={() => codeReviewStore.reset(props.laneId)}
                class="flex-shrink-0 px-3 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
              >
                Clear Review
              </button>
            </div>
          </Show>

          {/* Warning: Review Stale (New Changes) */}
          <Show when={reviewStatus().type === 'stale'}>
            <div class="flex-shrink-0 px-4 py-3 bg-orange-500/10 border-b border-orange-500/30 flex items-start gap-3">
              <svg class="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-orange-400 mb-1">New Changes Detected</h4>
                <p class="text-xs text-zed-text-secondary">
                  The working directory has changed since this review was generated. Regenerate to review the latest changes.
                </p>
              </div>
              <button
                onClick={handleRegenerate}
                class="flex-shrink-0 px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded transition-colors"
              >
                Regenerate
              </button>
            </div>
          </Show>

          <div id="main-review-content" class="flex-1 flex overflow-hidden">
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
