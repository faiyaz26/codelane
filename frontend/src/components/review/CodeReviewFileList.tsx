/**
 * CodeReviewFileList - Sidebar component for the Code Review tab
 *
 * Shows a simplified list of changed files with status badges.
 * Clicking a file scrolls to it in the ReviewFileScrollView.
 * The currently visible file is highlighted.
 */

import { For, Show, createMemo } from 'solid-js';
import { codeReviewStore } from '../../services/CodeReviewStore';
import type { FileChangeStats } from '../../types/git';

interface CodeReviewFileListProps {
  laneId: string;
}

export function CodeReviewFileList(props: CodeReviewFileListProps) {
  const reviewState = () => codeReviewStore.getState(props.laneId)();

  const sortedFiles = createMemo(() => reviewState().sortedFiles);
  const visibleFile = createMemo(() => reviewState().visibleFilePath);

  const totalAdditions = createMemo(() =>
    sortedFiles().reduce((sum, f) => sum + f.additions, 0)
  );
  const totalDeletions = createMemo(() =>
    sortedFiles().reduce((sum, f) => sum + f.deletions, 0)
  );

  const getStatusColor = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added': return 'text-green-400';
      case 'modified': return 'text-blue-400';
      case 'deleted': return 'text-red-400';
      case 'renamed': return 'text-yellow-400';
      case 'copied': return 'text-purple-400';
      default: return 'text-zed-text-secondary';
    }
  };

  const getStatusLetter = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added': return 'A';
      case 'modified': return 'M';
      case 'deleted': return 'D';
      case 'renamed': return 'R';
      case 'copied': return 'C';
      default: return '?';
    }
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
      <div class="flex-1 overflow-y-auto">
        <Show
          when={reviewState().status === 'ready'}
          fallback={
            <Show
              when={reviewState().status === 'loading'}
              fallback={
                <div class="p-4 text-center text-zed-text-tertiary text-sm">
                  <svg class="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l2 2 4-4" />
                  </svg>
                  Generate a review to see files
                </div>
              }
            >
              <div class="p-4 text-center text-zed-text-tertiary text-sm">
                Loading files...
              </div>
            </Show>
          }
        >
          <Show
            when={sortedFiles().length > 0}
            fallback={
              <div class="p-4 text-center text-zed-text-tertiary text-sm">
                No changes to review
              </div>
            }
          >
            <For each={sortedFiles()}>
              {(file) => (
                <button
                  onClick={() => codeReviewStore.requestScrollToFile(props.laneId, file.path)}
                  class={`w-full flex items-start gap-2 px-2 py-1.5 hover:bg-zed-bg-hover transition-colors text-left border-b border-zed-border-subtle/50 ${
                    visibleFile() === file.path ? 'bg-zed-bg-hover border-l-2 border-l-zed-accent-blue' : ''
                  }`}
                >
                  {/* Status Badge */}
                  <div class={`w-4 h-4 flex items-center justify-center text-xs font-bold rounded flex-shrink-0 ${getStatusColor(file.status)}`}>
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
                  <div class="text-xs font-mono flex-shrink-0 flex items-center gap-1">
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
