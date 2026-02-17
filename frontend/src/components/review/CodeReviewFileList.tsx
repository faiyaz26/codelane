/**
 * CodeReviewFileList - Sidebar component for the Code Review tab
 *
 * Shows a simplified list of changed files with status badges.
 * Clicking a file scrolls to it in the ReviewFileScrollView.
 * The currently visible file is highlighted.
 */

import { For, Show, createMemo, createSignal } from 'solid-js';
import { codeReviewStore } from '../../services/CodeReviewStore';
import type { FileChangeStats } from '../../types/git';

interface CodeReviewFileListProps {
  laneId: string;
}

export function CodeReviewFileList(props: CodeReviewFileListProps) {
  const reviewState = () => codeReviewStore.getState(props.laneId)();
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const sortedFiles = createMemo(() => reviewState().sortedFiles);
  const visibleFile = createMemo(() => reviewState().visibleFilePath);

  // Memoize O(n) aggregations to avoid recalculating on every render
  // Impact: Used in header display, reduces computation from O(n) to O(1) after first change
  const totalAdditions = createMemo(() =>
    sortedFiles().reduce((sum, f) => sum + f.additions, 0)
  );
  const totalDeletions = createMemo(() =>
    sortedFiles().reduce((sum, f) => sum + f.deletions, 0)
  );

  // Memoize status lookup maps for O(1) access instead of repeated switch statements
  // Impact: Each file item in the list calls getStatusColor/Letter - converting O(n) switch calls to O(1) lookups
  const statusColorMap = createMemo(() => {
    const map = new Map<string, string>();
    map.set('added', 'text-green-400');
    map.set('modified', 'text-blue-400');
    map.set('deleted', 'text-red-400');
    map.set('renamed', 'text-yellow-400');
    map.set('copied', 'text-purple-400');
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

  const getStatusColor = (status: FileChangeStats['status']) => {
    return statusColorMap().get(status) ?? 'text-zed-text-secondary';
  };

  const getStatusLetter = (status: FileChangeStats['status']) => {
    return statusLetterMap().get(status) ?? '?';
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getFileDir = (path: string) => {
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = Math.min(index + 1, sortedFiles().length - 1);
        setSelectedIndex(nextIndex);
        document.getElementById(`file-item-${nextIndex}`)?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = Math.max(index - 1, 0);
        setSelectedIndex(prevIndex);
        document.getElementById(`file-item-${prevIndex}`)?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        codeReviewStore.requestScrollToFile(props.laneId, sortedFiles()[index].path);
        break;
    }
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Summary Header */}
      <Show when={reviewState().status === 'ready' && sortedFiles().length > 0}>
        <div class="px-3 py-2 border-b border-zed-border-subtle bg-zed-bg-panel flex-shrink-0">
          <div class="flex items-center justify-between">
            <span class="text-xs text-zed-text-tertiary">
              {sortedFiles().length} {sortedFiles().length === 1 ? 'file' : 'files'} changed
            </span>
            <div class="flex items-center gap-2 text-xs font-mono">
              <span class="text-green-400">+{totalAdditions()}</span>
              <span class="text-red-400">-{totalDeletions()}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* File List */}
      <div
        class="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Changed files"
      >
        <Show
          when={reviewState().status === 'ready'}
          fallback={
            <Show
              when={reviewState().status === 'loading'}
              fallback={
                <div class="p-4 text-center text-zed-text-tertiary text-sm" role="status">
                  <svg class="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l2 2 4-4" />
                  </svg>
                  Generate a review to see files
                </div>
              }
            >
              <div class="p-4 text-center text-zed-text-tertiary text-sm" role="status">
                Loading files...
              </div>
            </Show>
          }
        >
          <Show
            when={sortedFiles().length > 0}
            fallback={
              <div class="p-4 text-center text-zed-text-tertiary text-sm" role="status">
                No changes to review
              </div>
            }
          >
            <For each={sortedFiles()}>
              {(file, index) => (
                <button
                  id={`file-item-${index()}`}
                  role="option"
                  aria-selected={visibleFile() === file.path}
                  aria-label={`${getStatusLetter(file.status)} ${getFileName(file.path)}, ${file.additions} additions, ${file.deletions} deletions`}
                  tabIndex={visibleFile() === file.path ? 0 : -1}
                  onClick={() => codeReviewStore.requestScrollToFile(props.laneId, file.path)}
                  onKeyDown={(e) => handleKeyDown(e, index())}
                  class={`w-full flex items-start gap-2 px-2 py-1.5 hover:bg-zed-bg-hover transition-colors text-left border-b border-zed-border-subtle/50 ${
                    visibleFile() === file.path ? 'bg-zed-bg-hover border-l-2 border-l-zed-accent-blue' : ''
                  }`}
                >
                  {/* Status Badge */}
                  <div class={`w-4 h-4 flex items-center justify-center text-xs font-bold rounded flex-shrink-0 ${getStatusColor(file.status)}`} aria-hidden="true">
                    {getStatusLetter(file.status)}
                  </div>

                  {/* File Info */}
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-zed-text-primary font-medium truncate">
                      {getFileName(file.path)}
                    </div>
                    <Show when={getFileDir(file.path)}>
                      <div class="text-xs text-zed-text-tertiary truncate">
                        {getFileDir(file.path)}
                      </div>
                    </Show>
                  </div>

                  {/* Line counts */}
                  <div class="text-xs font-mono flex-shrink-0 flex items-center gap-1" aria-hidden="true">
                    <span class="text-green-400">+{file.additions}</span>
                    <span class="text-red-400">-{file.deletions}</span>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
