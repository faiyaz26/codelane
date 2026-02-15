/**
 * Code Review Store
 *
 * Reactive store managing per-lane code review state.
 * Orchestrates AI review generation: fetches diffs, generates summary,
 * generates per-file feedback, and tracks scroll position for context panel.
 */

import { createSignal, createRoot, type Accessor } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { aiReviewService } from './AIReviewService';
import { codeReviewSettingsManager } from './CodeReviewSettingsManager';
import { getChangesWithStats, getGitDiff, getGitStatus } from '../lib/git-api';
import type { FileChangeStats } from '../types/git';

export type ReviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CodeReviewState {
  status: ReviewStatus;
  reviewMarkdown: string | null;
  perFileFeedback: Map<string, string>;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  error: string | null;
  generatedAt: number | null;
  visibleFilePath: string | null;
  loadingProgress: string | null;
  scrollToPath: string | null; // Path to scroll to (set by sidebar click, consumed by scroll view)
}

function createDefaultState(): CodeReviewState {
  return {
    status: 'idle',
    reviewMarkdown: null,
    perFileFeedback: new Map(),
    sortedFiles: [],
    scrollToPath: null,
    fileDiffs: new Map(),
    error: null,
    generatedAt: null,
    visibleFilePath: null,
    loadingProgress: null,
  };
}

// Per-lane state storage
const laneStates = new Map<string, {
  state: Accessor<CodeReviewState>;
  setState: (s: CodeReviewState | ((prev: CodeReviewState) => CodeReviewState)) => void;
}>();

function getOrCreateLaneState(laneId: string) {
  let entry = laneStates.get(laneId);
  if (!entry) {
    const created = createRoot(() => {
      const [state, setState] = createSignal<CodeReviewState>(createDefaultState());
      return { state, setState };
    });
    entry = created;
    laneStates.set(laneId, entry);
  }
  return entry;
}

/**
 * Run async tasks with a concurrency limit
 */
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function runNext(): Promise<void> {
    while (idx < tasks.length) {
      const currentIdx = idx++;
      results[currentIdx] = await tasks[currentIdx]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

export const codeReviewStore = {
  /**
   * Get reactive state for a lane
   */
  getState(laneId: string): Accessor<CodeReviewState> {
    return getOrCreateLaneState(laneId).state;
  },

  /**
   * Generate a full code review for a lane
   */
  async generateReview(laneId: string, workingDir: string): Promise<void> {
    const { setState } = getOrCreateLaneState(laneId);

    setState(prev => ({
      ...prev,
      status: 'loading',
      error: null,
      loadingProgress: 'Fetching changes...',
    }));

    // Setup timeout (5 minutes for large changesets)
    const timeoutMs = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Review generation timed out after 5 minutes. Try reducing the number of changed files or check your AI tool configuration.',
        loadingProgress: null,
      }));
    }, timeoutMs);

    try {
      // 1. Get changed files with stats
      const changesWithStats = await getChangesWithStats(workingDir);
      if (changesWithStats.length === 0) {
        setState(prev => ({
          ...prev,
          status: 'ready',
          reviewMarkdown: '## No Changes\n\nThere are no uncommitted changes to review.',
          perFileFeedback: new Map(),
          sortedFiles: [],
          fileDiffs: new Map(),
          generatedAt: Date.now(),
          loadingProgress: null,
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        loadingProgress: `Fetching diffs for ${changesWithStats.length} files...`,
      }));

      // 2. Get git status for staged/unstaged info
      const status = await getGitStatus(workingDir);
      const allChangedFiles = [
        ...status.staged.map(f => f.path),
        ...status.unstaged.map(f => f.path),
      ];

      // 3. Fetch diffs for all changed files
      const fileDiffs = new Map<string, string>();
      for (const filePath of allChangedFiles) {
        try {
          const diff = await getGitDiff(workingDir, filePath, false);
          if (diff && diff.trim()) {
            fileDiffs.set(filePath, diff);
          }
        } catch {
          // Skip files that can't be diffed (binary, etc.)
        }
      }

      // 4. Smart-sort files
      setState(prev => ({
        ...prev,
        loadingProgress: 'Sorting files...',
      }));

      let sortedFiles: FileChangeStats[];
      try {
        sortedFiles = await invoke<FileChangeStats[]>('git_sort_files', {
          files: changesWithStats,
          sortOrder: 'smart',
          workingDir,
        });
      } catch {
        sortedFiles = changesWithStats;
      }

      // 5. Generate overall AI summary
      const settings = codeReviewSettingsManager.getSettings()();
      const tool = settings.aiTool;
      const model = settings.aiModel[tool];
      const customReviewPrompt = settings.reviewPrompt;

      setState(prev => ({
        ...prev,
        loadingProgress: 'Generating AI summary...',
      }));

      const diffContent = Array.from(fileDiffs.entries())
        .map(([path, diff]) => `\`\`\`diff\n# File: ${path}\n${diff}\n\`\`\``)
        .join('\n\n');

      const reviewResult = await aiReviewService.generateReview({
        tool,
        diffContent,
        workingDir,
        customPrompt: customReviewPrompt || aiReviewService.getEnhancedReviewPrompt(),
        model,
      });

      const reviewMarkdown = reviewResult.success
        ? reviewResult.content
        : `## Error Generating Review\n\n${reviewResult.error || 'Unknown error'}`;

      console.log('[CodeReviewStore] Setting status to ready, markdown length:', reviewMarkdown.length);

      // Update state with summary (show layout immediately)
      try {
        setState(prev => {
          console.log('[CodeReviewStore] setState callback running, prev status:', prev.status);
          return {
            ...prev,
            status: 'ready' as ReviewStatus,
            reviewMarkdown,
            sortedFiles,
            fileDiffs,
            generatedAt: Date.now(),
            loadingProgress: null,
            scrollToPath: null,
          };
        });
        console.log('[CodeReviewStore] setState completed');
      } catch (err) {
        console.error('[CodeReviewStore] setState error:', err);
        throw err;
      }

      console.log('[CodeReviewStore] State updated to ready, status:', getOrCreateLaneState(laneId).state().status);

      // 6. Generate per-file feedback in parallel (non-blocking)
      const filePrompt = settings.filePrompt || aiReviewService.getDefaultFilePrompt();
      const filesToReview = sortedFiles.filter(f => fileDiffs.has(f.path));

      let completedFiles = 0;
      const tasks = filesToReview.map(file => async () => {
        const diff = fileDiffs.get(file.path);
        if (!diff) return;

        try {
          const result = await aiReviewService.generateFileReview(
            tool,
            file.path,
            diff,
            workingDir,
            model,
            filePrompt ? `${filePrompt}\n\nFile: ${file.path}` : undefined
          );

          if (result.success && result.content) {
            setState(prev => {
              const newFeedback = new Map(prev.perFileFeedback);
              newFeedback.set(file.path, result.content);
              return { ...prev, perFileFeedback: newFeedback };
            });
          }

          completedFiles++;
        } catch (err) {
          console.error(`Failed to generate review for ${file.path}:`, err);
          completedFiles++;
        }
      });

      // Run per-file reviews with concurrency limit of 3
      await parallelLimit(tasks, 3);

      // Clear timeout on success
      clearTimeout(timeoutId);

    } catch (err) {
      clearTimeout(timeoutId);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        loadingProgress: null,
      }));
    }
  },

  /**
   * Update the currently visible file (tracked by scroll position)
   */
  setVisibleFile(laneId: string, path: string | null) {
    const { state, setState } = getOrCreateLaneState(laneId);
    // Only update if different (prevent infinite loops)
    if (state().visibleFilePath !== path) {
      setState(prev => ({ ...prev, visibleFilePath: path }));
    }
  },

  /**
   * Request scroll to a specific file (called by sidebar file click)
   */
  requestScrollToFile(laneId: string, path: string) {
    const { setState } = getOrCreateLaneState(laneId);
    // Set path, then immediately clear (scroll view reads it via createEffect)
    setState(prev => ({ ...prev, scrollToPath: path }));
    // Use queueMicrotask to clear after current reactive cycle
    queueMicrotask(() => {
      setState(prev => ({ ...prev, scrollToPath: null }));
    });
  },

  /**
   * Reset review state back to idle
   */
  reset(laneId: string) {
    const { setState } = getOrCreateLaneState(laneId);
    setState(createDefaultState());
  },

  /**
   * Get combined review context for agent terminal
   */
  getReviewContext(laneId: string): string {
    const state = getOrCreateLaneState(laneId).state();
    if (state.status !== 'ready') return '';

    const parts: string[] = [];

    if (state.reviewMarkdown) {
      parts.push('# AI Code Review Summary\n');
      parts.push(state.reviewMarkdown);
      parts.push('\n---\n');
    }

    parts.push('# Changed Files\n');
    for (const file of state.sortedFiles) {
      parts.push(`- ${file.path} (${file.status}, +${file.additions}/-${file.deletions})`);
    }

    if (state.fileDiffs.size > 0) {
      parts.push('\n# Diffs\n');
      for (const [path, diff] of state.fileDiffs) {
        parts.push(`## ${path}\n\`\`\`diff\n${diff}\n\`\`\`\n`);
      }
    }

    return parts.join('\n');
  },
};
