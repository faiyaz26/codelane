// Hook for file system watching with debouncing

import { createEffect, onCleanup } from 'solid-js';
import { fileWatchService, type FileWatchEvent } from '../../../services/FileWatchService';

interface UseFileWatcherOptions {
  workingDir: () => string;
  expandedDirs: () => Set<string>;
  onRefreshNeeded: (dirPath: string) => void;
  debounceMs?: number;
}

export function useFileWatcher(options: UseFileWatcherOptions): void {
  const { workingDir, expandedDirs, onRefreshNeeded, debounceMs = 100 } = options;

  let currentUnsubscribe: (() => void) | null = null;
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  const pendingRefreshDirs = new Set<string>();

  const getParentPath = (filePath: string): string => {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
  };

  createEffect(() => {
    const currentWorkingDir = workingDir();

    // Clean up previous watcher
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }

    pendingRefreshDirs.clear();

    // Set up file watcher for the new directory
    fileWatchService
      .watchDirectory(currentWorkingDir, (event: FileWatchEvent) => {
        const parentDir = getParentPath(event.path);

        // Only refresh if the parent is expanded or is the root
        if (parentDir === currentWorkingDir || expandedDirs().has(parentDir)) {
          pendingRefreshDirs.add(parentDir);

          // Debounce refresh
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
          }
          refreshTimeout = setTimeout(() => {
            const dirsToRefresh = [...pendingRefreshDirs];
            pendingRefreshDirs.clear();

            for (const dir of dirsToRefresh) {
              onRefreshNeeded(dir);
            }
          }, debounceMs);
        }
      })
      .then((unsubscribe) => {
        currentUnsubscribe = unsubscribe;
      });
  });

  onCleanup(() => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
    }
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
  });
}
