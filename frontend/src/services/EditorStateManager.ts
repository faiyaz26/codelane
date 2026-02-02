// Editor State Manager - manages open files per lane

import { createSignal, createRoot } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import type { OpenFile } from '../components/editor/types';
import { detectLanguage } from '../components/editor/types';

interface LaneEditorState {
  openFiles: Map<string, OpenFile>;
  activeFileId: string | null;
  renderedFiles: Set<string>;
  saveCallbacks: Map<string, () => Promise<void>>;
}

class EditorStateManager {
  // State per lane
  private laneStates = new Map<string, LaneEditorState>();

  // Reactive signals for current lane (for UI updates)
  private currentLaneId = createSignal<string | null>(null);
  private updateTrigger = createSignal(0);

  // Get or create state for a lane
  private getOrCreateLaneState(laneId: string): LaneEditorState {
    let state = this.laneStates.get(laneId);
    if (!state) {
      state = {
        openFiles: new Map(),
        activeFileId: null,
        renderedFiles: new Set(),
        saveCallbacks: new Map(),
      };
      this.laneStates.set(laneId, state);
    }
    return state;
  }

  // Trigger reactive update
  private triggerUpdate() {
    const [, setTrigger] = this.updateTrigger;
    setTrigger((v) => v + 1);
  }

  // Get update signal (for reactivity)
  getUpdateSignal() {
    return this.updateTrigger[0];
  }

  // Set current lane
  setCurrentLane(laneId: string | null) {
    const [, setLaneId] = this.currentLaneId;
    setLaneId(laneId);
    this.triggerUpdate();
  }

  // Get open files for a lane
  getOpenFiles(laneId: string): Map<string, OpenFile> {
    // Access trigger for reactivity
    this.updateTrigger[0]();
    return this.getOrCreateLaneState(laneId).openFiles;
  }

  // Get active file ID for a lane
  getActiveFileId(laneId: string): string | null {
    // Access trigger for reactivity
    this.updateTrigger[0]();
    return this.getOrCreateLaneState(laneId).activeFileId;
  }

  // Get rendered files for a lane
  getRenderedFiles(laneId: string): Set<string> {
    // Access trigger for reactivity
    this.updateTrigger[0]();
    return this.getOrCreateLaneState(laneId).renderedFiles;
  }

  // Open a file in a lane
  async openFile(laneId: string, path: string): Promise<void> {
    const state = this.getOrCreateLaneState(laneId);

    // Check if already open
    const existingFile = Array.from(state.openFiles.values()).find((f) => f.path === path);
    if (existingFile) {
      state.activeFileId = existingFile.id;
      if (!state.renderedFiles.has(existingFile.id)) {
        state.renderedFiles.add(existingFile.id);
      }
      this.triggerUpdate();
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

    state.openFiles.set(id, newFile);
    state.activeFileId = id;
    state.renderedFiles.add(id);
    this.triggerUpdate();

    // Load content
    await this.loadFileContent(laneId, id, path);
  }

  // Load file content
  private async loadFileContent(laneId: string, fileId: string, path: string): Promise<void> {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const file = state.openFiles.get(fileId);
    if (!file) return;

    // Set loading state
    state.openFiles.set(fileId, { ...file, isLoading: true });
    this.triggerUpdate();

    try {
      const content = await invoke<string>('read_file', { path });

      const updatedFile = state.openFiles.get(fileId);
      if (updatedFile) {
        state.openFiles.set(fileId, {
          ...updatedFile,
          content,
          isLoading: false,
        });
        this.triggerUpdate();
      }
    } catch (err) {
      console.error('Failed to read file:', err);

      const updatedFile = state.openFiles.get(fileId);
      if (updatedFile) {
        state.openFiles.set(fileId, {
          ...updatedFile,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to read file',
        });
        this.triggerUpdate();
      }
    }
  }

  // Set active file
  setActiveFile(laneId: string, fileId: string): void {
    const state = this.getOrCreateLaneState(laneId);
    state.activeFileId = fileId;

    // Mark as rendered if not already
    if (!state.renderedFiles.has(fileId)) {
      state.renderedFiles.add(fileId);

      // Load content if not loaded
      const file = state.openFiles.get(fileId);
      if (file && file.content === null && !file.isLoading && !file.error) {
        this.loadFileContent(laneId, fileId, file.path);
      }
    }

    this.triggerUpdate();
  }

  // Close a file
  closeFile(laneId: string, fileId: string): boolean {
    const state = this.laneStates.get(laneId);
    if (!state) return false;

    state.openFiles.delete(fileId);
    state.renderedFiles.delete(fileId);

    // If closing active file, switch to another
    if (state.activeFileId === fileId) {
      const remaining = Array.from(state.openFiles.keys());
      if (remaining.length > 0) {
        state.activeFileId = remaining[remaining.length - 1];
      } else {
        state.activeFileId = null;
      }
    }

    this.triggerUpdate();

    // Return true if no files remain (for onAllFilesClosed callback)
    return state.openFiles.size === 0;
  }

  // Check if lane has open files
  hasOpenFiles(laneId: string): boolean {
    // Access trigger for reactivity
    this.updateTrigger[0]();
    const state = this.laneStates.get(laneId);
    return state ? state.openFiles.size > 0 : false;
  }

  // Set file modified state
  setFileModified(laneId: string, fileId: string, isModified: boolean): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const file = state.openFiles.get(fileId);
    if (file && file.isModified !== isModified) {
      state.openFiles.set(fileId, { ...file, isModified });
      this.triggerUpdate();
    }
  }

  // Update file content (after save)
  updateFileContent(laneId: string, fileId: string, content: string): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const file = state.openFiles.get(fileId);
    if (file) {
      state.openFiles.set(fileId, { ...file, content, isModified: false });
      this.triggerUpdate();
    }
  }

  // Register a save callback for a file
  registerSaveCallback(laneId: string, fileId: string, callback: () => Promise<void>): void {
    const state = this.getOrCreateLaneState(laneId);
    state.saveCallbacks.set(fileId, callback);
  }

  // Unregister a save callback for a file
  unregisterSaveCallback(laneId: string, fileId: string): void {
    const state = this.laneStates.get(laneId);
    if (state) {
      state.saveCallbacks.delete(fileId);
    }
  }

  // Save a file by calling its registered callback
  async saveFile(laneId: string, fileId: string): Promise<boolean> {
    const state = this.laneStates.get(laneId);
    if (!state) return false;

    const saveCallback = state.saveCallbacks.get(fileId);
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
    this.laneStates.delete(laneId);
    this.triggerUpdate();
  }
}

// Singleton instance
export const editorStateManager = new EditorStateManager();
