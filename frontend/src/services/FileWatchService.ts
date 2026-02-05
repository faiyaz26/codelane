// FileWatchService - centralized file watch event handling

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface FileWatchEvent {
  watch_id: string;
  path: string;
  kind: 'create' | 'modify' | 'delete' | 'rename';
}

type FileChangeCallback = (event: FileWatchEvent) => void;

interface WatchEntry {
  watchId: string;
  callbacks: Set<FileChangeCallback>;
}

class FileWatchService {
  private watches = new Map<string, WatchEntry>();
  // O(1) lookup from watchId to path
  private watchIdToPath = new Map<string, string>();
  private unlisten: (() => void) | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.unlisten = await listen<FileWatchEvent>('file-watch-event', (event) => {
      this.handleEvent(event.payload);
    });
    this.initialized = true;
  }

  private handleEvent(event: FileWatchEvent): void {
    // O(1) lookup using watchId -> path map
    const path = this.watchIdToPath.get(event.watch_id);
    if (!path) return;

    const entry = this.watches.get(path);
    if (!entry) return;

    // Notify all callbacks
    entry.callbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in file watch callback:', err);
      }
    });
  }

  /**
   * Watch a directory for changes
   * @param path Directory path to watch
   * @param callback Function called when changes occur
   * @param recursive Whether to watch subdirectories (default: true)
   * @returns Unsubscribe function
   */
  async watchDirectory(
    path: string,
    callback: FileChangeCallback,
    recursive = true
  ): Promise<() => void> {
    await this.init();

    let entry = this.watches.get(path);

    if (!entry) {
      const watchId = await invoke<string>('watch_path', { path, recursive });
      entry = { watchId, callbacks: new Set() };
      this.watches.set(path, entry);
      this.watchIdToPath.set(watchId, path);
    }

    entry.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      entry!.callbacks.delete(callback);

      // If no more callbacks, stop watching
      if (entry!.callbacks.size === 0) {
        this.watchIdToPath.delete(entry!.watchId);
        invoke('unwatch_path', { watchId: entry!.watchId }).catch(() => {});
        this.watches.delete(path);
      }
    };
  }

  /**
   * Watch a specific file for changes
   * Useful for open editor files
   */
  async watchFile(path: string, callback: FileChangeCallback): Promise<() => void> {
    return this.watchDirectory(path, callback, false);
  }

  /**
   * Dispose all watchers
   */
  dispose(): void {
    this.unlisten?.();
    this.unlisten = null;

    for (const [, entry] of this.watches) {
      invoke('unwatch_path', { watchId: entry.watchId }).catch(() => {});
    }

    this.watches.clear();
    this.watchIdToPath.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const fileWatchService = new FileWatchService();
