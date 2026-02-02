// Editor State Manager - manages open files per lane with SolidJS stores

import { createStore, produce } from 'solid-js/store';
import { batch } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import type { OpenFile } from '../components/editor/types';
import { detectLanguage, isMarkdownFile } from '../components/editor/types';

// Lane state structure
interface LaneState {
  openFiles: Record<string, OpenFile>;
  activeFileId: string | null;
  renderedFiles: Set<string>;
  saveCallbacks: Record<string, () => Promise<void>>;
}

// Store structure
interface EditorStore {
  // Per-lane state
  lanes: Record<string, LaneState>;
  // O(1) lookup: path -> { laneId, fileId }
  pathIndex: Record<string, { laneId: string; fileId: string }>;
}

class EditorStateManager {
  // SolidJS store for reactive state
  private store;
  private setStore;

  // Pending updates for batching
  private pendingBatch = false;

  constructor() {
    const storeResult = createStore<EditorStore>({
      lanes: {},
      pathIndex: {},
    });
    this.store = storeResult[0];
    this.setStore = storeResult[1];
  }

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

  // Helper: Update lane state with produce
  private updateLane(laneId: string, updater: (lane: LaneState) => void) {
    this.setStore(
      produce((store) => {
        if (store.lanes[laneId]) {
          updater(store.lanes[laneId]);
        }
      })
    );
  }

  // Helper: Update file in lane with produce
  private updateFile(laneId: string, fileId: string, updates: Partial<OpenFile>) {
    this.setStore(
      produce((store) => {
        if (store.lanes[laneId]?.openFiles[fileId]) {
          Object.assign(store.lanes[laneId].openFiles[fileId], updates);
        }
      })
    );
  }

  // Initialize lane if it doesn't exist
  private ensureLane(laneId: string) {
    if (!this.store.lanes[laneId]) {
      this.setStore(
        produce((store) => {
          store.lanes[laneId] = {
            openFiles: {},
            activeFileId: null,
            renderedFiles: new Set(),
            saveCallbacks: {},
          };
        })
      );
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
        this.updateLane(laneId, (lane) => {
          lane.activeFileId = existing.fileId;
          lane.renderedFiles.add(existing.fileId);
        });
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
      this.setStore(
        produce((store) => {
          // Add file to lane
          store.lanes[laneId].openFiles[id] = newFile;
          // Update path index
          store.pathIndex[path] = { laneId, fileId: id };
          // Set as active
          store.lanes[laneId].activeFileId = id;
          // Mark as rendered
          store.lanes[laneId].renderedFiles.add(id);
        })
      );
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
      // File already open, update scroll target, highlight, and force source mode for markdown
      const fileName = path.split('/').pop() || '';
      this.batchUpdate(() => {
        this.updateLane(laneId, (lane) => {
          const file = lane.openFiles[existing.fileId];
          if (file) {
            file.scrollToLine = line;
            file.highlightMatch = match ? { line, column: match.column, text: match.text } : undefined;
            file.forceSourceMode = isMarkdownFile(fileName) ? Date.now() : undefined;
          }
          lane.activeFileId = existing.fileId;
          lane.renderedFiles.add(existing.fileId);
        });
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
      forceSourceMode: isMarkdownFile(name) ? Date.now() : undefined,
    };

    // Batch all updates
    this.batchUpdate(() => {
      this.setStore(
        produce((store) => {
          store.lanes[laneId].openFiles[id] = newFile;
          store.pathIndex[path] = { laneId, fileId: id };
          store.lanes[laneId].activeFileId = id;
          store.lanes[laneId].renderedFiles.add(id);
        })
      );
    });

    // Load content
    await this.loadFileContent(laneId, id, path);
  }

  // Clear scroll-to-line target after scrolling
  clearScrollToLine(laneId: string, fileId: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane || !lane.openFiles[fileId]) return;

    if (lane.openFiles[fileId].scrollToLine !== undefined) {
      this.updateFile(laneId, fileId, { scrollToLine: undefined });
    }
  }

  // Clear highlight match for active file or all files in a lane
  clearHighlight(laneId: string, fileId?: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane) return;

    this.batchUpdate(() => {
      this.updateLane(laneId, (lane) => {
        if (fileId) {
          // Clear highlight for specific file
          const file = lane.openFiles[fileId];
          if (file?.highlightMatch !== undefined) {
            file.highlightMatch = undefined;
          }
        } else {
          // Clear highlights for all files in the lane
          for (const id in lane.openFiles) {
            if (lane.openFiles[id].highlightMatch !== undefined) {
              lane.openFiles[id].highlightMatch = undefined;
            }
          }
        }
      });
    });
  }

  // Load file content
  private async loadFileContent(laneId: string, fileId: string, path: string): Promise<void> {
    const lane = this.store.lanes[laneId];
    if (!lane || !lane.openFiles[fileId]) return;

    // Set loading state
    this.updateFile(laneId, fileId, { isLoading: true });

    try {
      const content = await invoke<string>('read_file', { path });

      // Check if file still exists (might have been closed while loading)
      if (this.store.lanes[laneId]?.openFiles[fileId]) {
        this.batchUpdate(() => {
          this.updateFile(laneId, fileId, { content, isLoading: false });
        });
      }
    } catch (err) {
      console.error('Failed to read file:', err);

      // Check if file still exists
      if (this.store.lanes[laneId]?.openFiles[fileId]) {
        this.batchUpdate(() => {
          this.updateFile(laneId, fileId, {
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
      this.updateLane(laneId, (lane) => {
        lane.activeFileId = fileId;
        lane.renderedFiles.add(fileId);
      });

      // Load content if not loaded
      const file = lane.openFiles[fileId];
      if (file && file.content === null && !file.isLoading && !file.error) {
        this.loadFileContent(laneId, fileId, file.path);
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
      this.setStore(
        produce((store) => {
          const lane = store.lanes[laneId];

          // Remove from path index
          delete store.pathIndex[file.path];

          // Remove from lane
          delete lane.openFiles[fileId];
          delete lane.saveCallbacks[fileId];
          lane.renderedFiles.delete(fileId);

          // If closing active file, switch to another
          if (lane.activeFileId === fileId) {
            const remaining = Object.keys(lane.openFiles);
            lane.activeFileId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
          }
        })
      );
    });

    // Return true if no files remain
    return Object.keys(this.store.lanes[laneId].openFiles).length === 0;
  }

  // Set file modified state
  setFileModified(laneId: string, fileId: string, isModified: boolean): void {
    const lane = this.store.lanes[laneId];
    if (!lane?.openFiles[fileId]) return;

    if (lane.openFiles[fileId].isModified !== isModified) {
      this.updateFile(laneId, fileId, { isModified });
    }
  }

  // Update file content (after save)
  updateFileContent(laneId: string, fileId: string, content: string): void {
    const lane = this.store.lanes[laneId];
    if (!lane?.openFiles[fileId]) return;

    this.batchUpdate(() => {
      this.updateFile(laneId, fileId, { content, isModified: false });
    });
  }

  // Register a save callback for a file
  registerSaveCallback(laneId: string, fileId: string, callback: () => Promise<void>): void {
    this.ensureLane(laneId);
    this.updateLane(laneId, (lane) => {
      lane.saveCallbacks[fileId] = callback;
    });
  }

  // Unregister a save callback for a file
  unregisterSaveCallback(laneId: string, fileId: string): void {
    const lane = this.store.lanes[laneId];
    if (lane) {
      this.updateLane(laneId, (lane) => {
        delete lane.saveCallbacks[fileId];
      });
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
      this.setStore(
        produce((store) => {
          const lane = store.lanes[laneId];

          // Remove all path index entries for this lane
          for (const fileId in lane.openFiles) {
            const file = lane.openFiles[fileId];
            delete store.pathIndex[file.path];
          }

          // Remove lane
          delete store.lanes[laneId];
        })
      );
    });
  }
}

// Singleton instance
export const editorStateManager = new EditorStateManager();
