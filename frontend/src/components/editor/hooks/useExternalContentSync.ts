// Hook for syncing editor content with external file changes
// Used by editors that maintain internal state (like MarkdownEditor with TipTap)

import { createSignal, createEffect } from 'solid-js';
import type { OpenFile } from '../types';

interface UseExternalContentSyncOptions {
  /** The file being edited (accessed as getter for reactivity) */
  file: OpenFile;
  /** Called when content should be reset due to external change */
  onExternalChange: (newContent: string) => void;
}

interface UseExternalContentSyncReturn {
  /** Current content (either from props or user edits) */
  content: () => string;
  /** Update content from user input */
  setContent: (value: string) => void;
  /** Whether user has made changes since last external sync */
  hasUserChanges: () => boolean;
  /** Mark content as synced with external (e.g., after save) */
  markSynced: () => void;
}

/**
 * Hook that manages content synchronization between editor internal state
 * and external file changes (e.g., file modified by another process).
 *
 * Pattern:
 * - Track file's lastKnownModifiedTime as a "version"
 * - When version changes and file.isModified is false, trigger onExternalChange
 * - User edits are tracked separately and preserved during external changes
 *   only if file.isModified is true
 */
export function useExternalContentSync(
  options: UseExternalContentSyncOptions
): UseExternalContentSyncReturn {
  // Local content state - starts from file content
  const [localContent, setLocalContent] = createSignal(options.file?.content || '');

  // Track if user has made any changes
  const [hasUserChanges, setHasUserChanges] = createSignal(false);

  // Track the last modification time we've seen
  let lastSeenModTime = options.file?.lastKnownModifiedTime;

  // Effect to detect external file changes
  createEffect(() => {
    const file = options.file;

    // Guard against undefined file (can happen during lane switches)
    if (!file) return;

    const currentModTime = file.lastKnownModifiedTime;
    const currentContent = file.content;

    // Check if this is an external update (mod time changed, file not user-modified)
    if (currentModTime !== lastSeenModTime && !file.isModified) {
      lastSeenModTime = currentModTime;

      // Update local state
      setLocalContent(currentContent || '');
      setHasUserChanges(false);

      // Notify editor to reset its internal state
      options.onExternalChange(currentContent || '');
    }
  });

  // User content update handler
  const setContent = (value: string) => {
    setLocalContent(value);
    setHasUserChanges(true);
  };

  // Mark as synced (e.g., after save)
  const markSynced = () => {
    setHasUserChanges(false);
    lastSeenModTime = options.file?.lastKnownModifiedTime;
  };

  return {
    content: localContent,
    setContent,
    hasUserChanges,
    markSynced,
  };
}
