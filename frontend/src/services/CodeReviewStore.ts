/**
 * Code Review Store - Facade
 *
 * Provides a unified API for code review operations.
 * Delegates to specialized services following Single Responsibility Principle:
 * - ReviewStateManager: Pure state management
 * - ReviewOrchestrator: Review generation flow
 * - ReviewFileProcessor: File operations
 * - ReviewScrollCoordinator: Scroll tracking
 *
 * This facade maintains backward compatibility with existing components.
 */

import { reviewStateManager } from './review/ReviewStateManager';
import { reviewOrchestrator } from './review/ReviewOrchestrator';
import { reviewScrollCoordinator } from './review/ReviewScrollCoordinator';
import type { Accessor } from 'solid-js';
import type { CodeReviewState } from './review/ReviewStateManager';

export const codeReviewStore = {
  /**
   * Get reactive state for a lane
   */
  getState(laneId: string): Accessor<CodeReviewState> {
    return reviewStateManager.getState(laneId);
  },

  /**
   * Generate a full code review for a lane
   */
  async generateReview(laneId: string, workingDir: string): Promise<void> {
    return reviewOrchestrator.generateReview(laneId, workingDir);
  },

  /**
   * Update the currently visible file (tracked by scroll position)
   */
  setVisibleFile(laneId: string, path: string | null): void {
    reviewScrollCoordinator.setVisibleFile(laneId, path);
  },

  /**
   * Request scroll to a specific file (called by sidebar file click)
   */
  requestScrollToFile(laneId: string, path: string): void {
    reviewScrollCoordinator.requestScrollToFile(laneId, path);
  },

  /**
   * Reset review state back to idle
   */
  reset(laneId: string): void {
    reviewStateManager.resetState(laneId);
  },

  /**
   * Cancel an ongoing review generation
   */
  cancelReview(laneId: string): void {
    reviewOrchestrator.cancelReview(laneId);
  },

  /**
   * Get combined review context for agent terminal
   */
  getReviewContext(laneId: string): string {
    return reviewScrollCoordinator.getReviewContext(laneId);
  },
};

// Re-export types for backward compatibility
export type {
  ReviewPhase,
  ReviewProgress,
  CodeReviewState,
} from './review/ReviewStateManager';
