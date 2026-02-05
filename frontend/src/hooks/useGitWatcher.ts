// useGitWatcher - Custom hook for watching file changes and refreshing git status
// This hook provides a consistent pattern for all components that need to:
// 1. Check if a directory is a git repo
// 2. Get git status (staged, unstaged, untracked files)
// 3. Watch for file changes and auto-refresh

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { isGitRepo, getGitStatus } from '../lib/git-api';
import { fileWatchService } from '../services/FileWatchService';
import type { GitStatusResult } from '../types/git';

interface UseGitWatcherOptions {
  /** Directory to watch - can be reactive (accessor function) or static string */
  workingDir: () => string | undefined;
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Callback when git status changes */
  onStatusChange?: (status: GitStatusResult | null, isRepo: boolean) => void;
}

interface UseGitWatcherReturn {
  /** Whether the directory is a git repository */
  isRepo: () => boolean | null;
  /** Current git status (null if not a repo or loading) */
  gitStatus: () => GitStatusResult | null;
  /** Whether we're currently loading */
  isLoading: () => boolean;
  /** Error message if any */
  error: () => string | null;
  /** Whether there are any changes (staged, unstaged, or untracked) */
  hasChanges: () => boolean;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

export function useGitWatcher(options: UseGitWatcherOptions): UseGitWatcherReturn {
  const debounceMs = options.debounceMs ?? 300;

  const [isRepoSignal, setIsRepo] = createSignal<boolean | null>(null);
  const [gitStatus, setGitStatus] = createSignal<GitStatusResult | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const loadStatus = async (dir: string) => {
    if (!dir) return;

    setIsLoading(true);
    setError(null);

    try {
      const repoCheck = await isGitRepo(dir);
      setIsRepo(repoCheck);

      if (repoCheck) {
        const status = await getGitStatus(dir);
        setGitStatus(status);
        options.onStatusChange?.(status, true);
      } else {
        setGitStatus(null);
        options.onStatusChange?.(null, false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setIsRepo(false);
      setGitStatus(null);
      options.onStatusChange?.(null, false);
    } finally {
      setIsLoading(false);
    }
  };

  // Watch for changes and auto-refresh
  createEffect(() => {
    const dir = options.workingDir();
    if (!dir) {
      setIsRepo(null);
      setGitStatus(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Initial load
    loadStatus(dir);

    // Set up file watching with debounce
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let isCancelled = false;

    // Capture dir in closure for the callback
    const currentDir = dir;

    fileWatchService
      .watchDirectory(currentDir, (_event) => {
        // Skip if this effect has been cleaned up
        if (isCancelled) return;

        // Debounce refresh
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        refreshTimeout = setTimeout(() => {
          if (!isCancelled) {
            loadStatus(currentDir);
          }
        }, debounceMs);
      })
      .then((unsub) => {
        // Only store unsubscribe if not cancelled
        if (!isCancelled) {
          unsubscribe = unsub;
        } else {
          // Already cancelled, clean up immediately
          unsub();
        }
      });

    onCleanup(() => {
      isCancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    });
  });

  const hasChanges = () => {
    const status = gitStatus();
    if (!status) return false;
    return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
  };

  const refresh = async () => {
    const dir = options.workingDir();
    if (dir) {
      await loadStatus(dir);
    }
  };

  return {
    isRepo: isRepoSignal,
    gitStatus,
    isLoading,
    error,
    hasChanges,
    refresh,
  };
}
