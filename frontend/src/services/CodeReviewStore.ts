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
import type { ReviewScopeConfig } from './review/ReviewOrchestrator';
import type { PendingReviewComment } from '../types/review';

export const codeReviewStore = {
  /**
   * Get reactive state for a lane
   */
  getState(laneId: string): Accessor<CodeReviewState> {
    return reviewStateManager.getState(laneId);
  },

  /**
   * Generate a full code review for a lane
   * @param scopeConfig - Optional scope config for branch/PR diff review
   */
  async generateReview(laneId: string, workingDir: string, scopeConfig?: ReviewScopeConfig): Promise<void> {
    return reviewOrchestrator.generateReview(laneId, workingDir, scopeConfig);
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

  /**
   * Add a pending review comment (not yet submitted to GitHub)
   */
  addPendingComment(laneId: string, path: string, line: number, body: string): void {
    const comment: PendingReviewComment = {
      id: crypto.randomUUID(),
      path,
      line,
      side: 'RIGHT',
      body,
      status: 'pending',
      createdAt: Date.now(),
    };
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      pendingComments: [...prev.pendingComments, comment],
    }));
  },

  /**
   * Update body of a pending review comment
   */
  updatePendingComment(laneId: string, commentId: string, body: string): void {
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      pendingComments: prev.pendingComments.map(c =>
        c.id === commentId ? { ...c, body } : c
      ),
    }));
  },

  /**
   * Remove a pending review comment
   */
  removePendingComment(laneId: string, commentId: string): void {
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      pendingComments: prev.pendingComments.filter(c => c.id !== commentId),
    }));
  },

  /**
   * Clear all pending comments (after successful submission)
   */
  clearPendingComments(laneId: string): void {
    reviewStateManager.setState(laneId, prev => ({
      ...prev,
      pendingComments: [],
    }));
  },
};

// Re-export types for backward compatibility
export type {
  ReviewPhase,
  ReviewProgress,
  CodeReviewState,
} from './review/ReviewStateManager';
