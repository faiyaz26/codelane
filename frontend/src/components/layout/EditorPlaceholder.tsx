import { Show } from 'solid-js';

interface EditorPlaceholderProps {
  selectedFile?: string;
}

export function EditorPlaceholder(props: EditorPlaceholderProps) {
  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      <Show
        when={props.selectedFile}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <svg
                class="w-16 h-16 mx-auto mb-4 text-zed-text-disabled"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 class="text-lg font-medium text-zed-text-secondary mb-2">No file selected</h3>
              <p class="text-sm text-zed-text-tertiary max-w-xs">
                Select a file from the explorer to view its contents, or use the agent terminal to work on your project.
              </p>
            </div>
          </div>
        }
      >
        {/* File Header */}
        <div class="h-9 border-b border-zed-border-subtle flex items-center px-4 bg-zed-bg-panel">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-zed-text-secondary">{props.selectedFile?.split('/').slice(-3).join(' > ')}</span>
          </div>
        </div>

        {/* Editor Area (placeholder) */}
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg
              class="w-12 h-12 mx-auto mb-3 text-zed-accent-blue opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <h3 class="text-sm font-medium text-zed-text-secondary mb-1">Code Editor</h3>
            <p class="text-xs text-zed-text-tertiary">Coming soon - Monaco integration</p>
          </div>
        </div>
      </Show>
    </div>
  );
}
