// External Change Modal - shown when user views a file that was modified externally

import { Show } from 'solid-js';

export type ExternalChangeResult = 'reload' | 'keep' | 'overwrite' | 'cancel';

interface ExternalChangeModalProps {
  isOpen: boolean;
  fileName: string;
  hasLocalChanges: boolean;
  onResult: (result: ExternalChangeResult) => void;
}

export function ExternalChangeModal(props: ExternalChangeModalProps) {
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
              class="w-6 h-6 text-zed-accent-blue flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <h2 class="text-base font-medium text-zed-text-primary">File Changed Externally</h2>
          </div>

          {/* Content */}
          <div class="px-4 py-4">
            <p class="text-sm text-zed-text-secondary">
              <span class="font-medium text-zed-text-primary">"{props.fileName}"</span> has been
              modified outside of Codelane.
            </p>

            <Show when={props.hasLocalChanges}>
              <p class="mt-2 text-sm text-zed-accent-yellow">
                You have unsaved changes that will be lost if you reload.
              </p>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-zed-border-subtle bg-zed-bg-surface rounded-b-lg">
            <button
              class="px-3 py-1.5 text-sm text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
              onClick={() => props.onResult('cancel')}
            >
              Cancel
            </button>
            <Show when={props.hasLocalChanges}>
              <button
                class="px-3 py-1.5 text-sm text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
                onClick={() => props.onResult('keep')}
              >
                Keep Editing
              </button>
              <button
                class="px-3 py-1.5 text-sm text-zed-accent-orange hover:bg-zed-accent-orange/10 rounded transition-colors"
                onClick={() => props.onResult('overwrite')}
              >
                Overwrite External
              </button>
            </Show>
            <button
              class="px-3 py-1.5 text-sm bg-zed-accent-blue text-white hover:bg-zed-accent-blue/90 rounded transition-colors"
              onClick={() => props.onResult('reload')}
            >
              {props.hasLocalChanges ? 'Discard & Reload' : 'Reload'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
