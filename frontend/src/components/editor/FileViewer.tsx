// File viewer component - displays file content with line numbers

import { createMemo, For, Show } from 'solid-js';
import type { OpenFile } from './types';
import { getLanguageDisplayName } from './types';

interface FileViewerProps {
  file: OpenFile | null;
}

export function FileViewer(props: FileViewerProps) {
  // Split content into lines
  const lines = createMemo(() => {
    if (!props.file?.content) return [];
    return props.file.content.split('\n');
  });

  // Calculate line number width based on total lines
  const lineNumberWidth = createMemo(() => {
    const numLines = lines().length;
    return Math.max(3, String(numLines).length);
  });

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      {/* No file selected state */}
      <Show when={!props.file}>
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
              Select a file from the explorer to view its contents.
            </p>
          </div>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={props.file?.isLoading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg class="w-8 h-8 mx-auto mb-3 animate-spin text-zed-accent-blue" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p class="text-sm text-zed-text-secondary">Loading file...</p>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={props.file?.error}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md">
            <svg
              class="w-12 h-12 mx-auto mb-3 text-zed-accent-red"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 class="text-sm font-medium text-zed-accent-red mb-2">Failed to load file</h3>
            <p class="text-xs text-zed-text-tertiary">{props.file?.error}</p>
          </div>
        </div>
      </Show>

      {/* File content */}
      <Show when={props.file && !props.file.isLoading && !props.file.error && props.file.content !== null}>
        {/* File info bar */}
        <div class="h-7 px-4 border-b border-zed-border-subtle flex items-center justify-between text-xs bg-zed-bg-panel">
          <div class="flex items-center gap-2 text-zed-text-tertiary truncate">
            <span class="truncate">{props.file!.path}</span>
          </div>
          <div class="flex items-center gap-4 text-zed-text-disabled flex-shrink-0">
            <span>{lines().length} lines</span>
            <span>{getLanguageDisplayName(props.file!.language)}</span>
          </div>
        </div>

        {/* Code view */}
        <div class="flex-1 overflow-auto font-mono text-sm">
          <div class="min-w-full">
            <Show
              when={lines().length > 0}
              fallback={
                <div class="p-4 text-zed-text-tertiary italic">Empty file</div>
              }
            >
              <table class="w-full border-collapse">
                <tbody>
                  <For each={lines()}>
                    {(line, index) => (
                      <tr class="hover:bg-zed-bg-hover/50 group">
                        {/* Line number */}
                        <td
                          class="px-4 py-0 text-right text-zed-text-disabled select-none border-r border-zed-border-subtle bg-zed-bg-panel/50 sticky left-0"
                          style={{ width: `${lineNumberWidth() + 2}ch` }}
                        >
                          {index() + 1}
                        </td>
                        {/* Line content */}
                        <td class="px-4 py-0 whitespace-pre text-zed-text-primary">
                          {line || ' '}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
