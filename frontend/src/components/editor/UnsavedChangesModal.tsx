// Unsaved Changes Modal - confirmation dialog with Save, Discard, Cancel options

import { Show } from 'solid-js';

export type UnsavedChangesResult = 'save' | 'discard' | 'cancel';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  fileName: string;
  onResult: (result: UnsavedChangesResult) => void;
}

export function UnsavedChangesModal(props: UnsavedChangesModalProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onResult('cancel');
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onKeyDown={handleKeyDown}
        onClick={() => props.onResult('cancel')}
      >
        <div
          class="bg-zed-bg-panel border border-zed-border-default rounded-lg shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-zed-border-subtle">
            <svg
              class="w-6 h-6 text-zed-accent-yellow flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 class="text-base font-medium text-zed-text-primary">Unsaved Changes</h2>
          </div>

          {/* Content */}
          <div class="px-4 py-4">
            <p class="text-sm text-zed-text-secondary">
              <span class="font-medium text-zed-text-primary">"{props.fileName}"</span> has unsaved
              changes. What would you like to do?
            </p>
          </div>

          {/* Actions */}
          <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-zed-border-subtle bg-zed-bg-surface rounded-b-lg">
            <button
              class="px-3 py-1.5 text-sm text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
              onClick={() => props.onResult('cancel')}
            >
              Cancel
            </button>
            <button
              class="px-3 py-1.5 text-sm text-zed-accent-red hover:bg-zed-accent-red/10 rounded transition-colors"
              onClick={() => props.onResult('discard')}
            >
              Discard Changes
            </button>
            <button
              class="px-3 py-1.5 text-sm bg-zed-accent-blue text-white hover:bg-zed-accent-blue/90 rounded transition-colors"
              onClick={() => props.onResult('save')}
            >
              Save and Close
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
