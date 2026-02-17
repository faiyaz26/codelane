/**
 * FileContextPanel - Bottom 1/3 of the right half
 *
 * Shows AI-generated per-file feedback for the currently visible file.
 * Content updates reactively based on scroll position in ReviewFileScrollView.
 */

import { Show, createMemo } from 'solid-js';
import { MarkdownRenderer } from '../../lib/markdown/MarkdownRenderer';

interface FileContextPanelProps {
  filePath: string | null;
  feedback: string | null;
  fileStatus?: string;
}

export function FileContextPanel(props: FileContextPanelProps) {
  // Memoize path parsing to avoid repeated string operations on every render
  // Impact: Even for single file display, memoization avoids re-parsing on every render cycle
  const getFileName = createMemo(() => {
    if (!props.filePath) return '';
    const parts = props.filePath.split('/');
    return parts[parts.length - 1];
  });

  // Memoize status lookup maps for efficient color/letter resolution
  // Impact: Convert repeated switch statements to O(1) map lookups
  const statusColorMap = createMemo(() => {
    const map = new Map<string, string>();
    map.set('added', 'text-green-400');
    map.set('modified', 'text-blue-400');
    map.set('deleted', 'text-red-400');
    map.set('renamed', 'text-yellow-400');
    return map;
  });

  const statusLetterMap = createMemo(() => {
    const map = new Map<string, string>();
    map.set('added', 'A');
    map.set('modified', 'M');
    map.set('deleted', 'D');
    map.set('renamed', 'R');
    map.set('copied', 'C');
    return map;
  });

  const getStatusColor = createMemo(() => {
    return statusColorMap().get(props.fileStatus!) ?? 'text-zed-text-secondary';
  });

  const getStatusLetter = createMemo(() => {
    return statusLetterMap().get(props.fileStatus!) ?? '?';
  });

  return (
    <div class="flex flex-col h-full overflow-hidden bg-zed-bg-panel">
      {/* Header */}
      <div class="px-3 py-2 border-b border-zed-border-subtle flex items-center gap-2 flex-shrink-0">
        <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-medium text-zed-text-primary">File Context</span>
        <Show when={props.filePath && props.fileStatus}>
          <span class={`text-xs font-bold ${getStatusColor()}`}>{getStatusLetter()}</span>
          <span class="text-xs text-zed-text-secondary truncate">{getFileName()}</span>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-3">
        <Show
          when={props.filePath}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-center">
              <svg class="w-8 h-8 mb-2 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p class="text-xs text-zed-text-tertiary">Scroll through files to see context</p>
            </div>
          }
        >
          <Show
            when={props.feedback}
            fallback={
              <div class="flex flex-col items-center justify-center h-full text-center">
                <svg class="w-8 h-8 mb-2 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-xs text-zed-text-tertiary">No feedback for this file</p>
              </div>
            }
          >
            <MarkdownRenderer
              markdown={props.feedback || ''}
              mode="simple"
              class="prose prose-sm prose-invert max-w-none text-xs text-zed-text-secondary leading-relaxed [&_h1]:text-sm [&_h1]:text-zed-text-primary [&_h2]:text-xs [&_h2]:text-zed-text-primary [&_h3]:text-xs [&_h3]:text-zed-text-primary [&_strong]:text-zed-text-primary [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-zed-bg-hover [&_code]:px-1 [&_code]:rounded [&_code]:text-zed-accent-blue"
            />
          </Show>
        </Show>
      </div>
    </div>
  );
}

