// Hook for markdown file save functionality
// Handles save state, error handling, and EditorStateManager integration

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { editorStateManager } from '../../../../services/EditorStateManager';
import { normalizeForComparison } from './useTipTapEditor';

export interface UseMarkdownSaveOptions {
  laneId?: string;
  fileId?: string;
  filePath: string;
  getContent: () => string;
  onSaveComplete?: (content: string) => void;
  onModifiedChange?: (isModified: boolean) => void;
}

export interface UseMarkdownSaveResult {
  isSaving: () => boolean;
  saveError: () => string | null;
  isModified: () => boolean;
  setOriginalContent: (content: string) => void;
  checkIfModified: (content: string) => boolean;
  updateModifiedState: (content: string) => void;
  save: () => Promise<void>;
}

export function useMarkdownSave(options: UseMarkdownSaveOptions): UseMarkdownSaveResult {
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [isModified, setIsModified] = createSignal(false);

  // Original content for comparison (normalized after TipTap processes it)
  let originalNormalizedContent = '';

  const setOriginalContent = (content: string) => {
    originalNormalizedContent = normalizeForComparison(content);
  };

  const checkIfModified = (currentContent: string): boolean => {
    return normalizeForComparison(currentContent) !== originalNormalizedContent;
  };

  const updateModifiedState = (currentContent: string) => {
    const modified = checkIfModified(currentContent);
    if (isModified() !== modified) {
      setIsModified(modified);
      options.onModifiedChange?.(modified);
      if (options.laneId && options.fileId) {
        editorStateManager.setFileModified(options.laneId, options.fileId, modified);
      }
    }
  };

  const save = async () => {
    if (!isModified() || isSaving()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const contentToSave = options.getContent();

      await invoke('write_file', {
        path: options.filePath,
        contents: contentToSave,
      });

      // Update the original content to the saved content
      originalNormalizedContent = normalizeForComparison(contentToSave);
      setIsModified(false);
      options.onModifiedChange?.(false);

      // Notify EditorStateManager
      if (options.laneId && options.fileId) {
        editorStateManager.updateFileContent(options.laneId, options.fileId, contentToSave);
      }

      options.onSaveComplete?.(contentToSave);
    } catch (err) {
      console.error('Failed to save file:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    saveError,
    isModified,
    setOriginalContent,
    checkIfModified,
    updateModifiedState,
    save,
  };
}
