/**
 * useReviewKeyboardShortcuts - Custom hook for Code Review keyboard navigation
 *
 * Provides keyboard shortcuts for common review actions:
 * - Cmd/Ctrl+R: Regenerate review
 * - Escape: Cancel current operation
 * - j/ArrowDown: Navigate to next file
 * - k/ArrowUp: Navigate to previous file
 * - Cmd/Ctrl+B: Toggle sidebar
 */

import { onMount, onCleanup } from 'solid-js';

export interface ReviewKeyboardShortcutsOptions {
  onRegenerate?: () => void;
  onCancel?: () => void;
  onNextFile?: () => void;
  onPrevFile?: () => void;
  onToggleSidebar?: () => void;
}

export function useReviewKeyboardShortcuts(options: ReviewKeyboardShortcutsOptions) {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Keyboard shortcuts
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      options.onRegenerate?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      options.onCancel?.();
    } else if (e.key === 'j' || e.key === 'ArrowDown') {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options.onNextFile?.();
      }
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        options.onPrevFile?.();
      }
    } else if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      options.onToggleSidebar?.();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}
