// useGitService - Hook that wraps GitWatcherService for component use
// Uses the centralized git watcher (one watcher per lane, shared across components)

import { createSignal, createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import { gitWatcherService } from '../services/GitWatcherService';
import type { GitStatusResult } from '../types/git';

interface UseGitServiceOptions {
  laneId: () => string | undefined;
  workingDir: () => string | undefined;
}

interface UseGitServiceReturn {
  isRepo: () => boolean | null;
  gitStatus: () => GitStatusResult | null;
  isLoading: () => boolean;
  error: () => string | null;
  hasChanges: () => boolean;
  refresh: () => Promise<void>;
}

interface LaneGitState {
  isRepo: boolean | null;
  status: GitStatusResult | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

const INITIAL_STATE: LaneGitState = {
  isRepo: null,
  status: null,
  isLoading: true,
  error: null,
  lastUpdated: 0,
};

export function useGitService(options: UseGitServiceOptions): UseGitServiceReturn {
  const [stateAccessor, setStateAccessor] = createSignal<Accessor<LaneGitState> | null>(null);
  const [currentLaneId, setCurrentLaneId] = createSignal<string | undefined>();

  createEffect(() => {
    // Only track laneId and workingDir as dependencies
    const laneId = options.laneId();
    const workingDir = options.workingDir();

    // untrack: subscribe() calls startWatching() → loadGitStatus() → state.get()
    // Without untrack, that state.get() would be tracked by this effect,
    // causing infinite re-runs when state.set() fires.
    untrack(() => {
      setCurrentLaneId(laneId);

      if (!laneId || !workingDir) {
        setStateAccessor(null);
        return;
      }

      const { state, unsubscribe } = gitWatcherService.subscribe(laneId, workingDir);
      setStateAccessor(() => state);

      onCleanup(() => {
        unsubscribe();
      });
    });
  });

  const gitState = (): LaneGitState => stateAccessor()?.() ?? INITIAL_STATE;

  return {
    isRepo: () => gitState().isRepo,
    gitStatus: () => gitState().status,
    isLoading: () => gitState().isLoading,
    error: () => gitState().error,
    hasChanges: () => {
      const status = gitState().status;
      if (!status) return false;
      return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
    },
    refresh: async () => {
      const laneId = currentLaneId();
      if (laneId) {
        await gitWatcherService.refresh(laneId);
      }
    },
  };
}
