/**
 * useGitChanges - Hook for watching git file changes with statistics
 *
 * Uses the GitWatcherService to detect file changes, then fetches
 * detailed statistics (additions/deletions) for the Code Review view.
 */

import { createSignal, createEffect, onCleanup, untrack } from 'solid-js';
import { gitWatcherService } from '../services/GitWatcherService';
import { getChangesWithStats } from '../lib/git-api';
import type { FileChangeStats } from '../types/git';

interface UseGitChangesOptions {
  laneId: string;
  workingDir: string;
}

interface UseGitChangesReturn {
  changes: () => FileChangeStats[];
  isLoading: () => boolean;
  error: () => string | null;
  refresh: () => Promise<void>;
}

export function useGitChanges(options: UseGitChangesOptions): UseGitChangesReturn {
  const [changes, setChanges] = createSignal<FileChangeStats[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  let currentLaneId = options.laneId;
  let currentWorkingDir = options.workingDir;

  // Fetch file changes with statistics
  const fetchChanges = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stats = await getChangesWithStats(currentWorkingDir);
      setChanges(stats);
    } catch (err) {
      console.error('Failed to fetch git changes:', err);
      setError(err instanceof Error ? err.message : String(err));
      setChanges([]);
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    // Subscribe to git watcher for this lane
    const { state, unsubscribe } = gitWatcherService.subscribe(
      currentLaneId,
      currentWorkingDir
    );

    // Watch for git status updates
    createEffect(() => {
      const gitState = state();

      // When git status changes, refresh the file change stats
      if (gitState.isRepo && !gitState.isLoading && !gitState.error) {
        untrack(() => {
          fetchChanges();
        });
      } else if (!gitState.isRepo) {
        // Not a git repo
        setChanges([]);
        setIsLoading(false);
      }
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  return {
    changes,
    isLoading,
    error,
    refresh: fetchChanges,
  };
}
