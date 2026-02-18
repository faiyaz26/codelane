/**
 * GitWatcherService - Centralized git status monitoring per lane
 *
 * Provides a single source of truth for git status across the app.
 * - One watcher per lane (not per component)
 * - Event-driven (file changes trigger refresh, not polling)
 * - Debounced with adaptive timing based on system load
 * - Broadcasts status to all subscribers via signals
 */

import { createSignal, createRoot, batch, type Accessor } from 'solid-js';
import { isGitRepo, getGitStatus, getChangesWithStats } from '../lib/git-api';
import { fileWatchService, type FileWatchEvent } from './FileWatchService';
import { resourceManager } from './ResourceManager';
import type { GitStatusResult } from '../types/git';

// Debounce timings
const DEBOUNCE_NORMAL = 500; // 500ms debounce for file changes
const DEBOUNCE_HIGH_LOAD = 1500; // 1.5s debounce when system is under load

interface LaneGitState {
  isRepo: boolean | null;
  status: GitStatusResult | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

interface LaneWatchEntry {
  workingDir: string;
  state: {
    get: Accessor<LaneGitState>;
    set: (state: LaneGitState) => void;
  };
  fileWatcherUnsubscribe: (() => void) | null;
  debounceTimeout: ReturnType<typeof setTimeout> | null;
  subscriberCount: number;
}

// Map of laneId -> watch entry
const laneWatchers = new Map<string, LaneWatchEntry>();

// Map of watchId -> laneId for O(1) lookup (used by FileWatchService optimization)
const watchIdToLane = new Map<string, string>();

function createInitialState(): LaneGitState {
  return {
    isRepo: null,
    status: null,
    isLoading: true,
    error: null,
    lastUpdated: 0,
  };
}

async function loadGitStatus(entry: LaneWatchEntry): Promise<void> {
  const { workingDir, state } = entry;
  const current = state.get();

  // Only show loading spinner on initial load (no existing data).
  // Subsequent refreshes keep existing data visible while loading in background.
  if (current.status === null && current.isRepo === null) {
    state.set({
      ...current,
      isLoading: true,
      error: null,
    });
  }

  try {
    const repoCheck = await isGitRepo(workingDir);

    if (repoCheck) {
      // Fetch both status and stats in parallel for efficiency
      const [status, changesWithStats] = await Promise.all([
        getGitStatus(workingDir),
        getChangesWithStats(workingDir),
      ]);

      // Combine into single status object
      const combinedStatus: GitStatusResult = {
        ...status,
        changesWithStats,
      };

      state.set({
        isRepo: true,
        status: combinedStatus,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } else {
      state.set({
        isRepo: false,
        status: null,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    }
  } catch (err) {
    state.set({
      isRepo: false,
      status: null,
      isLoading: false,
      error: err instanceof Error ? err.message : String(err),
      lastUpdated: Date.now(),
    });
  }
}

function handleFileChange(laneId: string, event: FileWatchEvent): void {
  const entry = laneWatchers.get(laneId);
  if (!entry) return;

  // Selectively handle .git directory changes:
  // - Allow .git/HEAD (branch switch) and .git/refs/ (commits, branch ops)
  // - Ignore everything else in .git/ (objects, logs, index) to avoid
  //   refresh loops since git status itself can update .git/index
  if (event.path.includes('/.git/') || event.path.endsWith('/.git')) {
    const isHeadChange = event.path.endsWith('/.git/HEAD');
    const isRefsChange = event.path.includes('/.git/refs/');
    if (!isHeadChange && !isRefsChange) return;
  }

  // Clear existing debounce
  if (entry.debounceTimeout) {
    clearTimeout(entry.debounceTimeout);
  }

  // Get appropriate debounce time based on system load
  const debounceMs = resourceManager.isHighLoad()()
    ? DEBOUNCE_HIGH_LOAD
    : DEBOUNCE_NORMAL;

  // Schedule refresh
  entry.debounceTimeout = setTimeout(() => {
    entry.debounceTimeout = null;
    loadGitStatus(entry);
  }, debounceMs);
}

async function startWatching(laneId: string, entry: LaneWatchEntry): Promise<void> {
  // Load initial status
  await loadGitStatus(entry);

  // Only watch if it's a git repo
  if (entry.state.get().isRepo) {
    try {
      entry.fileWatcherUnsubscribe = await fileWatchService.watchDirectory(
        entry.workingDir,
        (event) => handleFileChange(laneId, event),
        true // recursive
      );
    } catch (err) {
      // Non-critical - git status will just be stale without file watching
    }
  }
}

function stopWatching(entry: LaneWatchEntry): void {
  if (entry.fileWatcherUnsubscribe) {
    entry.fileWatcherUnsubscribe();
    entry.fileWatcherUnsubscribe = null;
  }

  if (entry.debounceTimeout) {
    clearTimeout(entry.debounceTimeout);
    entry.debounceTimeout = null;
  }
}

// Export the git watcher service API
export const gitWatcherService = {
  /**
   * Subscribe to git status for a lane.
   * Creates a watcher if one doesn't exist for this lane.
   * Returns an accessor for the git state and an unsubscribe function.
   */
  subscribe(
    laneId: string,
    workingDir: string
  ): { state: Accessor<LaneGitState>; unsubscribe: () => void } {
    let entry = laneWatchers.get(laneId);

    if (!entry) {
      // Create new watcher for this lane
      const { state, setState } = createRoot((dispose) => {
        const [state, setState] = createSignal<LaneGitState>(createInitialState());
        return { state, setState, dispose };
      });

      entry = {
        workingDir,
        state: { get: state, set: setState },
        fileWatcherUnsubscribe: null,
        debounceTimeout: null,
        subscriberCount: 0,
      };

      laneWatchers.set(laneId, entry);

      // Start watching (async, don't await)
      startWatching(laneId, entry);
    }

    entry.subscriberCount++;

    const unsubscribe = () => {
      const e = laneWatchers.get(laneId);
      if (!e) return;

      e.subscriberCount--;

      // Clean up when no more subscribers
      if (e.subscriberCount <= 0) {
        stopWatching(e);
        laneWatchers.delete(laneId);
      }
    };

    return {
      state: entry.state.get,
      unsubscribe,
    };
  },

  /**
   * Force refresh git status for a lane
   */
  async refresh(laneId: string): Promise<void> {
    const entry = laneWatchers.get(laneId);
    if (entry) {
      await loadGitStatus(entry);
    }
  },

  /**
   * Force refresh all lanes (useful after bulk operations)
   */
  async refreshAll(): Promise<void> {
    const promises = Array.from(laneWatchers.entries()).map(([, entry]) =>
      loadGitStatus(entry)
    );
    await Promise.all(promises);
  },

  /**
   * Check if a lane has any git changes
   */
  hasChanges(laneId: string): boolean {
    const entry = laneWatchers.get(laneId);
    if (!entry) return false;

    const status = entry.state.get().status;
    if (!status) return false;

    return (
      status.staged.length > 0 ||
      status.unstaged.length > 0 ||
      status.untracked.length > 0
    );
  },

  /**
   * Update the working directory for a lane (e.g., when lane config changes)
   */
  async updateWorkingDir(laneId: string, newWorkingDir: string): Promise<void> {
    const entry = laneWatchers.get(laneId);
    if (!entry) return;

    if (entry.workingDir === newWorkingDir) return;

    // Stop current watching
    stopWatching(entry);

    // Update working dir and restart
    entry.workingDir = newWorkingDir;
    entry.state.set(createInitialState());

    await startWatching(laneId, entry);
  },

  /**
   * Dispose all watchers (call on app shutdown)
   */
  dispose(): void {
    for (const [, entry] of laneWatchers) {
      stopWatching(entry);
    }
    laneWatchers.clear();
    watchIdToLane.clear();
  },
};
