/**
 * Review Orchestrator
 *
 * Coordinates the entire review generation flow:
 * 1. Fetch changed files
 * 2. Fetch diffs
 * 3. Sort files
 * 4. Generate AI summary
 * 5. Generate per-file feedback
 *
 * Uses ReviewStateManager for state updates.
 * Uses ReviewFileProcessor for file operations.
 * Uses AIReviewService for AI generation.
 */

import { reviewStateManager } from './ReviewStateManager';
import { reviewFileProcessor } from './ReviewFileProcessor';
import { aiReviewService } from '../AIReviewService';
import { codeReviewSettingsManager } from '../CodeReviewSettingsManager';
import { processDiffsWithTruncation, getTruncationSummary } from '../../utils/diffTruncation';
import { filterReviewableFiles, getExclusionSummary } from '../../utils/fileFilters';
import type { ReviewPhase } from './ReviewStateManager';

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

export class ReviewOrchestrator {
  private abortControllers = new Map<string, AbortController>();

  /**
   * Cancel an ongoing review generation
   */
  cancelReview(laneId: string): void {
    const controller = this.abortControllers.get(laneId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(laneId);
    }
  }

  /**
   * Generate a full code review for a lane
   */
  async generateReview(laneId: string, workingDir: string): Promise<void> {
    // Cancel any existing review for this lane
    this.cancelReview(laneId);

    // Create new controller for this generation
    const controller = new AbortController();
    this.abortControllers.set(laneId, controller);
    // Reset state to fetching-changes
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      status: 'fetching-changes',
      error: null,
      progress: {
        phase: 'fetching-changes',
        totalFiles: 0,
        processedFiles: 0,
        currentFile: null,
      },
    }));

    // Setup timeout (5 minutes for large changesets)
    const timeoutMs = 5 * 60 * 1000;
    const timeoutId = setTimeout(() => {
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'error',
        error: 'Review generation timed out after 5 minutes. Try reducing the number of changed files or check your AI tool configuration.',
        progress: {
          phase: 'error',
          totalFiles: 0,
          processedFiles: 0,
          currentFile: null,
        },
      }));
    }, timeoutMs);

    try {
      // 1. Get changed files with stats
      const changesWithStats = await reviewFileProcessor.fetchChangesWithStats(workingDir);

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      if (changesWithStats.length === 0) {
        reviewStateManager.setState(laneId, prev => ({
          ...prev,
          status: 'ready',
          reviewMarkdown: '## No Changes\n\nThere are no uncommitted changes to review.',
          perFileFeedback: new Map(),
          sortedFiles: [],
          fileDiffs: new Map(),
          generatedAt: Date.now(),
          progress: {
            phase: 'ready',
            totalFiles: 0,
            processedFiles: 0,
            currentFile: null,
          },
        }));
        clearTimeout(timeoutId);
        this.abortControllers.delete(laneId);
        return;
      }

      // 2. Fetch diffs for top files (for summary) - lazy load rest on demand
      // Only fetch top 10 files for the AI summary to save time and bandwidth
      // Remaining files are lazy-loaded in ReviewFileScrollView as user scrolls
      const TOP_FILES_FOR_SUMMARY = 10;
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'fetching-diffs',
        progress: {
          phase: 'fetching-diffs',
          totalFiles: changesWithStats.length,
          processedFiles: 0,
          currentFile: null,
        },
      }));

      // Fetch only top files for summary (reduces initial load time from O(n) to O(1))
      const fileDiffs = await reviewFileProcessor.fetchFileDiffs(
        workingDir,
        changesWithStats,
        { eager: true, topN: TOP_FILES_FOR_SUMMARY, signal: controller.signal }
      );

      // Update progress to reflect actual fetched files
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          processedFiles: Math.min(TOP_FILES_FOR_SUMMARY, changesWithStats.length),
        },
      }));

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      // 3. Smart-sort files
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'sorting-files',
        progress: {
          phase: 'sorting-files',
          totalFiles: changesWithStats.length,
          processedFiles: changesWithStats.length,
          currentFile: null,
        },
      }));

      const sortedFiles = await reviewFileProcessor.sortFiles(changesWithStats, workingDir);

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      // 4. Generate overall AI summary
      const settings = codeReviewSettingsManager.getSettings()();
      const tool = settings.aiTool;
      const model = settings.aiModel[tool];
      const customReviewPrompt = settings.reviewPrompt;

      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'generating-summary',
        progress: {
          phase: 'generating-summary',
          totalFiles: changesWithStats.length,
          processedFiles: changesWithStats.length,
          currentFile: null,
        },
      }));

      // Apply smart truncation to large diffs
      const truncatedDiffs = processDiffsWithTruncation(fileDiffs, {
        maxLines: 500,
        maxBytes: 50 * 1024,
        linesPerHunk: 5,
      });

      const truncationSummary = getTruncationSummary(fileDiffs);
      const truncationNote = truncationSummary.truncated > 0
        ? `\n\n**Note:** ${truncationSummary.truncated} large file(s) were truncated to save tokens: ${truncationSummary.files.join(', ')}\n\n`
        : '';

      const diffContent = Array.from(truncatedDiffs.entries())
        .map(([path, diff]) => `\`\`\`diff\n# File: ${path}\n${diff}\n\`\`\``)
        .join('\n\n');

      const reviewResult = await aiReviewService.generateReview({
        tool,
        diffContent,
        workingDir,
        customPrompt: customReviewPrompt || aiReviewService.getEnhancedReviewPrompt(),
        model,
        signal: controller.signal,
      });

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      const reviewMarkdown = reviewResult.success
        ? truncationNote + reviewResult.content
        : `## Error Generating Review\n\n${reviewResult.error || 'Unknown error'}`;

      // 5. Update state with summary (show layout immediately)
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'ready' as ReviewPhase,
        reviewMarkdown,
        sortedFiles,
        fileDiffs,
        generatedAt: Date.now(),
        progress: {
          phase: 'ready',
          totalFiles: changesWithStats.length,
          processedFiles: changesWithStats.length,
          currentFile: null,
        },
        scrollToPath: null,
      }));

      // 6. Generate per-file feedback in parallel (non-blocking)
      const filePrompt = settings.filePrompt || aiReviewService.getDefaultFilePrompt();
      const concurrency = settings.concurrency || 4; // Get configurable concurrency limit

      // Filter out files that shouldn't be reviewed (based on user settings)
      const reviewableFiles = filterReviewableFiles(
        sortedFiles,
        settings.excludeCategories,
        settings.customExcludePatterns
      );
      const filesToReview = reviewableFiles.filter(f => fileDiffs.has(f.path));

      // Log exclusions for debugging
      const exclusionSummary = getExclusionSummary(
        sortedFiles,
        settings.excludeCategories,
        settings.customExcludePatterns
      );
      if (exclusionSummary.excluded > 0) {
        console.log(
          `[Review] Excluded ${exclusionSummary.excluded} files from review:`,
          exclusionSummary.files
        );
      }

      // Update to generating-file-feedback phase
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'generating-file-feedback',
        progress: {
          phase: 'generating-file-feedback',
          totalFiles: filesToReview.length,
          processedFiles: 0,
          currentFile: null,
        },
      }));

      let completedFiles = 0;
      const tasks = filesToReview.map(file => async () => {
        // Check before starting each file
        if (controller.signal.aborted) {
          return;
        }

        let diff = fileDiffs.get(file.path);
        if (!diff) return;

        // Apply truncation if diff is too large
        if (diff) {
          const processedDiffs = processDiffsWithTruncation(new Map([[file.path, diff]]), {
            maxLines: 500,
            maxBytes: 50 * 1024,
            linesPerHunk: 5,
          });
          diff = processedDiffs.get(file.path) || diff;
        }

        // Update current file being processed
        reviewStateManager.setState(laneId, prev => ({
          ...prev,
          progress: {
            ...prev.progress,
            currentFile: file.path,
          },
        }));

        try {
          const result = await aiReviewService.generateFileReview(
            tool,
            file.path,
            diff,
            workingDir,
            model,
            filePrompt ? `${filePrompt}\n\nFile: ${file.path}` : undefined,
            controller.signal
          );

          // Check after completion
          if (controller.signal.aborted) {
            return;
          }

          if (result.success && result.content) {
            reviewStateManager.setState(laneId, prev => {
              const newFeedback = new Map(prev.perFileFeedback);
              newFeedback.set(file.path, result.content);
              return {
                ...prev,
                perFileFeedback: newFeedback,
                progress: {
                  ...prev.progress,
                  processedFiles: completedFiles + 1,
                },
              };
            });
          }

          completedFiles++;
        } catch (err) {
          // Silent failure - continue with other files
          completedFiles++;
          reviewStateManager.setState(laneId, prev => ({
            ...prev,
            progress: {
              ...prev.progress,
              processedFiles: completedFiles,
            },
          }));
        }
      });

      // Run per-file reviews with configurable concurrency limit
      await parallelLimit(tasks, concurrency);

      // Update state to ready after all per-file feedback is complete
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'ready',
        progress: {
          phase: 'ready',
          totalFiles: filesToReview.length,
          processedFiles: filesToReview.length,
          currentFile: null,
        },
      }));

      // Clear timeout on success
      clearTimeout(timeoutId);
      this.abortControllers.delete(laneId);

    } catch (err) {
      clearTimeout(timeoutId);
      this.abortControllers.delete(laneId);

      // Check if error is due to abort
      if (err instanceof Error && err.message.includes('Operation cancelled')) {
        reviewStateManager.setState(laneId, prev => ({
          ...prev,
          status: 'idle',
          progress: {
            phase: 'idle',
            totalFiles: 0,
            processedFiles: 0,
            currentFile: null,
          },
        }));
        return;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        progress: {
          phase: 'error',
          totalFiles: 0,
          processedFiles: 0,
          currentFile: null,
        },
      }));
    }
  }
}

// Export singleton instance
export const reviewOrchestrator = new ReviewOrchestrator();
