/**
 * Review Scroll Coordinator
 *
 * Manages scroll position tracking and file visibility for code review.
 * Coordinates scrolling to specific files and tracking which file is visible.
 */

import { reviewStateManager } from './ReviewStateManager';

export class ReviewScrollCoordinator {
  /**
   * Update the currently visible file (tracked by scroll position)
   */
  setVisibleFile(laneId: string, path: string | null): void {
    const currentState = reviewStateManager.getStateSnapshot(laneId);

    // Only update if different (prevent infinite loops)
    if (currentState.visibleFilePath !== path) {
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        visibleFilePath: path,
      }));
    }
  }

  /**
   * Request scroll to a specific file (called by sidebar file click)
   */
  requestScrollToFile(laneId: string, path: string): void {
    // Set path, then immediately clear (scroll view reads it via createEffect)
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      scrollToPath: path,
    }));

    // Use queueMicrotask to clear after current reactive cycle
    queueMicrotask(() => {
      reviewStateManager.setState(laneId, prev => ({
        ...prev,
        scrollToPath: null,
      }));
    });
  }

  /**
   * Get combined review context for agent terminal
   * Returns markdown-formatted context including summary, files, and diffs
   */
  getReviewContext(laneId: string): string {
    const state = reviewStateManager.getStateSnapshot(laneId);

    if (state.status !== 'ready') {
      return '';
    }

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
  }
}

// Export singleton instance
export const reviewScrollCoordinator = new ReviewScrollCoordinator();
