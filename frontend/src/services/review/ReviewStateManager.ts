/**
 * Review State Manager
 *
 * Pure state management for code review.
 * Responsible only for creating and managing reactive state per lane.
 * NO business logic, NO API calls.
 */

import { createSignal, createRoot, type Accessor } from 'solid-js';
import type { FileChangeStats } from '../../types/git';

export type ReviewPhase =
  | 'idle'
  | 'fetching-changes'
  | 'fetching-diffs'
  | 'sorting-files'
  | 'generating-summary'
  | 'generating-file-feedback'
  | 'ready'
  | 'error';

export interface ReviewProgress {
  phase: ReviewPhase;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
}

export interface CodeReviewState {
  status: ReviewPhase;
  reviewMarkdown: string | null;
  perFileFeedback: Map<string, string>;
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;
  error: string | null;
  generatedAt: number | null;
  visibleFilePath: string | null;
  progress: ReviewProgress;
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
    progress: {
      phase: 'idle',
      totalFiles: 0,
      processedFiles: 0,
      currentFile: null,
    },
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

export class ReviewStateManager {
  /**
   * Get reactive state for a lane
   */
  getState(laneId: string): Accessor<CodeReviewState> {
    return getOrCreateLaneState(laneId).state;
  }

  /**
   * Update state for a lane
   */
  setState(
    laneId: string,
    updater: CodeReviewState | ((prev: CodeReviewState) => CodeReviewState)
  ): void {
    const { setState } = getOrCreateLaneState(laneId);
    setState(updater);
  }

  /**
   * Reset state for a lane back to default
   */
  resetState(laneId: string): void {
    const { setState } = getOrCreateLaneState(laneId);
    setState(createDefaultState());
  }

  /**
   * Get current state snapshot (non-reactive)
   */
  getStateSnapshot(laneId: string): CodeReviewState {
    return getOrCreateLaneState(laneId).state();
  }
}

// Export singleton instance
export const reviewStateManager = new ReviewStateManager();
