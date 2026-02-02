// Editor State Manager - manages open files per lane with SolidJS stores

import { createStore, produce } from 'solid-js/store';
import { batch } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import type { OpenFile } from '../components/editor/types';
import { detectLanguage } from '../components/editor/types';

// Store structure
interface EditorStore {
  // Per-lane state
  lanes: Record<
    string,
    {
      openFiles: Record<string, OpenFile>;
      activeFileId: string | null;
      renderedFiles: Set<string>;
      saveCallbacks: Record<string, () => Promise<void>>;
    }
  >;
  // O(1) lookup: path -> { laneId, fileId }
  pathIndex: Record<string, { laneId: string; fileId: string }>;
}

class EditorStateManager {
  // SolidJS store for reactive state
  private [store, setStore] = createStore<EditorStore>({
    lanes: {},
    pathIndex: {},
  });

  // Pending updates for batching
  private pendingBatch = false;

  // Public store access
  getStore() {
    return this.store;
  }

  // Batch multiple updates into one render
  private batchUpdate(fn: () => void) {
    if (this.pendingBatch) {
      fn();
    } else {
      this.pendingBatch = true;
      batch(() => {
        fn();
        this.pendingBatch = false;
      });
    }
  }

  // Initialize lane if it doesn't exist
  private ensureLane(laneId: string) {
    if (!this.store.lanes[laneId]) {
      setStore('lanes', laneId, {
        openFiles: {},
        activeFileId: null,
        renderedFiles: new Set(),
        saveCallbacks: {},
      });
    }
  }

  // Get open files for a lane (reactive)
  getOpenFiles(laneId: string): Record<string, OpenFile> {
    return this.store.lanes[laneId]?.openFiles ?? {};
  }

  // Get active file ID for a lane (reactive)
  getActiveFileId(laneId: string): string | null {
    return this.store.lanes[laneId]?.activeFileId ?? null;
  }

  // Get rendered files for a lane (reactive)
  getRenderedFiles(laneId: string): Set<string> {
    return this.store.lanes[laneId]?.renderedFiles ?? new Set();
  }

  // Check if lane has open files (reactive)
  hasOpenFiles(laneId: string): boolean {
    const files = this.store.lanes[laneId]?.openFiles;
    return files ? Object.keys(files).length > 0 : false;
  }

  // Open a file in a lane
  async openFile(laneId: string, path: string): Promise<void> {
    this.ensureLane(laneId);

    // Check path index for O(1) lookup
    const existing = this.store.pathIndex[path];
    if (existing && existing.laneId === laneId) {
      // File already open in this lane, just activate it
      this.batchUpdate(() => {
        setStore('lanes', laneId, 'activeFileId', existing.fileId);
        if (!this.store.lanes[laneId].renderedFiles.has(existing.fileId)) {
          setStore('lanes', laneId, 'renderedFiles', (files) => {
            const newSet = new Set(files);
            newSet.add(existing.fileId);
            return newSet;
          });
        }
      });
      return;
    }

    // Create new file entry
    const id = crypto.randomUUID();
    const name = path.split('/').pop() || 'Untitled';
    const language = detectLanguage(name);

    const newFile: OpenFile = {
      id,
      path,
      name,
      content: null,
      isLoading: false,
      isModified: false,
      error: null,
      language,
    };

    // Batch all updates together
    this.batchUpdate(() => {
      // Add file to lane
      setStore('lanes', laneId, 'openFiles', id, newFile);
      // Update path index
      setStore('pathIndex', path, { laneId, fileId: id });
      // Set as active
      setStore('lanes', laneId, 'activeFileId', id);
      // Mark as rendered
      setStore('lanes', laneId, 'renderedFiles', (files) => {
        const newSet = new Set(files);
        newSet.add(id);
        return newSet;
      });
    });

    // Load content asynchronously
    await this.loadFileContent(laneId, id, path);
  }

  // Open a file at a specific line number (for search results)
  async openFileAtLine(
    laneId: string,
    path: string,
    line: number,
    match?: { column: number; text: string }
  ): Promise<void> {
    this.ensureLane(laneId);

    // Check path index for O(1) lookup
    const existing = this.store.pathIndex[path];
    if (existing && existing.laneId === laneId) {
      // File already open, update scroll target and highlight
      this.batchUpdate(() => {
        setStore('lanes', laneId, 'openFiles', existing.fileId, {
          scrollToLine: line,
          highlightMatch: match ? { line, column: match.column, text: match.text } : undefined,
        });
        setStore('lanes', laneId, 'activeFileId', existing.fileId);
        if (!this.store.lanes[laneId].renderedFiles.has(existing.fileId)) {
          setStore('lanes', laneId, 'renderedFiles', (files) => {
            const newSet = new Set(files);
            newSet.add(existing.fileId);
            return newSet;
          });
        }
      });
      return;
    }

    // Create new file entry with scroll target
    const id = crypto.randomUUID();
    const name = path.split('/').pop() || 'Untitled';
    const language = detectLanguage(name);

    const newFile: OpenFile = {
      id,
      path,
      name,
      content: null,
      isLoading: false,
      isModified: false,
      error: null,
      language,
      scrollToLine: line,
      highlightMatch: match ? { line, column: match.column, text: match.text } : undefined,
    };

    // Batch all updates
    this.batchUpdate(() => {
      setStore('lanes', laneId, 'openFiles', id, newFile);
      setStore('pathIndex', path, { laneId, fileId: id });
      setStore('lanes', laneId, 'activeFileId', id);
      setStore('lanes', laneId, 'renderedFiles', (files) => {
        const newSet = new Set(files);
        newSet.add(id);
        return newSet;
      });
    });

    // Load content
    await this.loadFileContent(laneId, id, path);
  }

  // Clear scroll-to-line target after scrolling
  clearScrollToLine(laneId: string, fileId: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane || !lane.openFiles[fileId]) return;

    if (lane.openFiles[fileId].scrollToLine !== undefined) {
      setStore('lanes', laneId, 'openFiles', fileId, 'scrollToLine', undefined);
    }
  }

  // Clear highlight match for active file or all files in a lane
  clearHighlight(laneId: string, fileId?: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane) return;

    this.batchUpdate(() => {
      if (fileId) {
        // Clear highlight for specific file
        if (lane.openFiles[fileId]?.highlightMatch !== undefined) {
          setStore('lanes', laneId, 'openFiles', fileId, 'highlightMatch', undefined);
        }
      } else {
        // Clear highlights for all files in the lane
        for (const id in lane.openFiles) {
          if (lane.openFiles[id].highlightMatch !== undefined) {
            setStore('lanes', laneId, 'openFiles', id, 'highlightMatch', undefined);
          }
        }
      }
    });
  }

  // Load file content
  private async loadFileContent(laneId: string, fileId: string, path: string): Promise<void> {
    const lane = this.store.lanes[laneId];
    if (!lane || !lane.openFiles[fileId]) return;

    // Set loading state
    setStore('lanes', laneId, 'openFiles', fileId, 'isLoading', true);

    try {
      const content = await invoke<string>('read_file', { path });

      // Check if file still exists (might have been closed while loading)
      if (this.store.lanes[laneId]?.openFiles[fileId]) {
        this.batchUpdate(() => {
          setStore('lanes', laneId, 'openFiles', fileId, {
            content,
            isLoading: false,
          });
        });
      }
    } catch (err) {
      console.error('Failed to read file:', err);

      // Check if file still exists
      if (this.store.lanes[laneId]?.openFiles[fileId]) {
        this.batchUpdate(() => {
          setStore('lanes', laneId, 'openFiles', fileId, {
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to read file',
          });
        });
      }
    }
  }

  // Set active file
  setActiveFile(laneId: string, fileId: string): void {
    this.ensureLane(laneId);
    const lane = this.store.lanes[laneId];

    this.batchUpdate(() => {
      setStore('lanes', laneId, 'activeFileId', fileId);

      // Mark as rendered if not already
      if (!lane.renderedFiles.has(fileId)) {
        setStore('lanes', laneId, 'renderedFiles', (files) => {
          const newSet = new Set(files);
          newSet.add(fileId);
          return newSet;
        });

        // Load content if not loaded
        const file = lane.openFiles[fileId];
        if (file && file.content === null && !file.isLoading && !file.error) {
          this.loadFileContent(laneId, fileId, file.path);
        }
      }
    });
  }

  // Close a file
  closeFile(laneId: string, fileId: string): boolean {
    const lane = this.store.lanes[laneId];
    if (!lane) return false;

    const file = lane.openFiles[fileId];
    if (!file) return false;

    this.batchUpdate(() => {
      // Remove from path index
      setStore('pathIndex', file.path, undefined!);

      // Remove from lane
      setStore('lanes', laneId, 'openFiles', fileId, undefined!);
      setStore('lanes', laneId, 'saveCallbacks', fileId, undefined!);
      setStore('lanes', laneId, 'renderedFiles', (files) => {
        const newSet = new Set(files);
        newSet.delete(fileId);
        return newSet;
      });

      // If closing active file, switch to another
      if (lane.activeFileId === fileId) {
        const remaining = Object.keys(lane.openFiles).filter((id) => id !== fileId);
        if (remaining.length > 0) {
          setStore('lanes', laneId, 'activeFileId', remaining[remaining.length - 1]);
        } else {
          setStore('lanes', laneId, 'activeFileId', null);
        }
      }
    });

    // Return true if no files remain
    return Object.keys(this.store.lanes[laneId].openFiles).length === 0;
  }

  // Set file modified state
  setFileModified(laneId: string, fileId: string, isModified: boolean): void {
    const lane = this.store.lanes[laneId];
    if (!lane?.openFiles[fileId]) return;

    if (lane.openFiles[fileId].isModified !== isModified) {
      setStore('lanes', laneId, 'openFiles', fileId, 'isModified', isModified);
    }
  }

  // Update file content (after save)
  updateFileContent(laneId: string, fileId: string, content: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane?.openFiles[fileId]) return;

    this.batchUpdate(() => {
      setStore('lanes', laneId, 'openFiles', fileId, {
        content,
        isModified: false,
      });
    });
  }

  // Register a save callback for a file
  registerSaveCallback(laneId: string, fileId: string, callback: () => Promise<void>): void {
    this.ensureLane(laneId);
    setStore('lanes', laneId, 'saveCallbacks', fileId, callback);
  }

  // Unregister a save callback for a file
  unregisterSaveCallback(laneId: string, fileId: string): void {
    const lane = this.store.lanes[laneId];
    if (lane) {
      setStore('lanes', laneId, 'saveCallbacks', fileId, undefined!);
    }
  }

  // Save a file by calling its registered callback
  async saveFile(laneId: string, fileId: string): Promise<boolean> {
    const lane = this.store.lanes[laneId];
    if (!lane) return false;

    const saveCallback = lane.saveCallbacks[fileId];
    if (saveCallback) {
      try {
        await saveCallback();
        return true;
      } catch (err) {
        console.error('Failed to save file:', err);
        return false;
      }
    }
    return false;
  }

  // Dispose lane state
  disposeLane(laneId: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane) return;

    this.batchUpdate(() => {
      // Remove all path index entries for this lane
      for (const fileId in lane.openFiles) {
        const file = lane.openFiles[fileId];
        setStore('pathIndex', file.path, undefined!);
      }

      // Remove lane
      setStore('lanes', laneId, undefined!);
    });
  }
}

// Singleton instance
export const editorStateManager = new EditorStateManager();
