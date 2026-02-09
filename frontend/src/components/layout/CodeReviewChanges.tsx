import { createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useGitChanges } from '../../hooks/useGitChanges';
import { editorStateManager } from '../../services/EditorStateManager';
import type { FileChangeStats } from '../../types/git';

export type FileSortOrder = 'alphabetical' | 'smart' | 'smart-dependencies' | 'change-size' | 'none';

interface CodeReviewChangesProps {
  laneId: string;
  workingDir: string;
  onFileSelect?: (path: string) => void;
}

export function CodeReviewChanges(props: CodeReviewChangesProps) {
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [sortOrder, setSortOrder] = createSignal<FileSortOrder>('smart');
  const [sortedFiles, setSortedFiles] = createSignal<FileChangeStats[]>([]);

  // Watch for git changes (auto-refreshes when files change)
  const gitChanges = useGitChanges({
    laneId: props.laneId,
    workingDir: props.workingDir,
  });

  // Load sort order from localStorage
  onMount(() => {
    const saved = localStorage.getItem('codelane:fileSortOrder');
    if (saved && ['alphabetical', 'smart', 'smart-dependencies', 'change-size', 'none'].includes(saved)) {
      setSortOrder(saved as FileSortOrder);
    }

    // Listen for sort order changes from settings
    const handleSortOrderChange = (event: CustomEvent<FileSortOrder>) => {
      setSortOrder(event.detail);
    };
    window.addEventListener('fileSortOrderChanged', handleSortOrderChange as EventListener);

    onCleanup(() => {
      window.removeEventListener('fileSortOrderChanged', handleSortOrderChange as EventListener);
    });
  });

  // Sort files whenever changes or sort order updates
  createEffect(async () => {
    const files = gitChanges.changes();
    const order = sortOrder();

    if (files.length === 0) {
      setSortedFiles([]);
      return;
    }

    try {
      const sorted = await invoke<FileChangeStats[]>('git_sort_files', {
        files,
        sortOrder: order,
        workingDir: props.workingDir,
      });
      setSortedFiles(sorted);
    } catch (error) {
      console.error('Failed to sort files:', error);
      // Fallback to unsorted
      setSortedFiles(files);
    }
  });

  const handleFileClick = async (file: FileChangeStats) => {
    setSelectedFile(file.path);
    // Open file in diff view mode
    await editorStateManager.openFileDiff(props.laneId, file.path, props.workingDir);
  };

  const getStatusColor = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-400';
      case 'modified':
        return 'text-blue-400';
      case 'deleted':
        return 'text-red-400';
      case 'renamed':
        return 'text-yellow-400';
      case 'copied':
        return 'text-purple-400';
      default:
        return 'text-zed-text-secondary';
    }
  };

  const getStatusIcon = (status: FileChangeStats['status']) => {
    switch (status) {
      case 'added':
        return 'A';
      case 'modified':
        return 'M';
      case 'deleted':
        return 'D';
      case 'renamed':
        return 'R';
      case 'copied':
        return 'C';
      default:
        return '?';
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getFilePath = (path: string) => {
    const parts = path.split('/');
    if (parts.length === 1) return '';
    return parts.slice(0, -1).join('/');
  };

  const handleSortOrderChange = (newOrder: FileSortOrder) => {
    setSortOrder(newOrder);
    localStorage.setItem('codelane:fileSortOrder', newOrder);
  };

  const totalAdditions = () => gitChanges.changes().reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = () => gitChanges.changes().reduce((sum, f) => sum + f.deletions, 0);
  const fileCount = () => gitChanges.changes().length;

  const getSortIcon = () => {
    switch (sortOrder()) {
      case 'smart':
      case 'smart-dependencies':
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'alphabetical':
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        );
      case 'change-size':
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        );
      default:
        return (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        );
    }
  };

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Summary Header */}
      <div class="px-3 py-2 border-b border-zed-border-subtle bg-zed-bg-panel">
        <div class="flex items-center justify-between mb-1">
          <div class="text-xs text-zed-text-tertiary">
            <Show when={!gitChanges.isLoading()} fallback={<span>Loading...</span>}>
              {fileCount()} {fileCount() === 1 ? 'file' : 'files'} changed
            </Show>
          </div>

          {/* Sort Order Dropdown */}
          <div class="relative group">
            <button
              class="flex items-center gap-1.5 px-2 py-1 text-xs text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
              title="Change sort order"
            >
              {getSortIcon()}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            <div class="hidden group-hover:block absolute right-0 top-full mt-1 w-48 bg-zed-bg-overlay border border-zed-border-default rounded-md shadow-lg z-10">
              <div class="py-1">
                <button
                  class={`w-full px-3 py-2 text-left text-sm hover:bg-zed-bg-hover transition-colors flex items-center gap-2 ${
                    sortOrder() === 'smart' ? 'text-zed-accent-blue' : 'text-zed-text-primary'
                  }`}
                  onClick={() => handleSortOrderChange('smart')}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Smart (Recommended)</span>
                </button>
                <button
                  class={`w-full px-3 py-2 text-left text-sm hover:bg-zed-bg-hover transition-colors flex items-center gap-2 ${
                    sortOrder() === 'smart-dependencies' ? 'text-zed-accent-blue' : 'text-zed-text-primary'
                  }`}
                  onClick={() => handleSortOrderChange('smart-dependencies')}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Smart + Dependencies</span>
                </button>
                <button
                  class={`w-full px-3 py-2 text-left text-sm hover:bg-zed-bg-hover transition-colors flex items-center gap-2 ${
                    sortOrder() === 'alphabetical' ? 'text-zed-accent-blue' : 'text-zed-text-primary'
                  }`}
                  onClick={() => handleSortOrderChange('alphabetical')}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  <span>Alphabetical</span>
                </button>
                <button
                  class={`w-full px-3 py-2 text-left text-sm hover:bg-zed-bg-hover transition-colors flex items-center gap-2 ${
                    sortOrder() === 'change-size' ? 'text-zed-accent-blue' : 'text-zed-text-primary'
                  }`}
                  onClick={() => handleSortOrderChange('change-size')}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span>Change Size</span>
                </button>
                <button
                  class={`w-full px-3 py-2 text-left text-sm hover:bg-zed-bg-hover transition-colors flex items-center gap-2 ${
                    sortOrder() === 'none' ? 'text-zed-accent-blue' : 'text-zed-text-primary'
                  }`}
                  onClick={() => handleSortOrderChange('none')}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>Git Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs font-mono">
          <span class="text-green-400">+{totalAdditions()}</span>
          <span class="text-red-400">-{totalDeletions()}</span>
        </div>
      </div>

      {/* File List */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={!gitChanges.isLoading()}
          fallback={
            <div class="p-4 text-center text-zed-text-tertiary text-sm">
              Loading changes...
            </div>
          }
        >
          <Show
            when={fileCount() > 0}
            fallback={
              <div class="p-4 text-center text-zed-text-tertiary text-sm">
                No changes to review
              </div>
            }
          >
            <For each={sortedFiles()}>
              {(file) => (
                <button
                  onClick={() => handleFileClick(file)}
                  class={`w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-zed-bg-hover transition-colors text-left border-b border-zed-border-subtle/50 ${
                    selectedFile() === file.path ? 'bg-zed-bg-hover' : ''
                  }`}
                >
                  {/* Status Badge */}
                  <div
                    class={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded flex-shrink-0 mt-0.5 ${getStatusColor(
                      file.status
                    )}`}
                  >
                    {getStatusIcon(file.status)}
                  </div>

                  {/* File Info */}
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-zed-text-primary font-medium truncate">
                      {getFileName(file.path)}
                    </div>
                    {getFilePath(file.path) && (
                      <div class="text-xs text-zed-text-tertiary truncate mt-0.5">
                        {getFilePath(file.path)}
                      </div>
                    )}
                    {file.status !== 'deleted' && file.status !== 'added' && (
                      <div class="text-xs mt-1 font-mono">
                        <span class="text-green-400">+{file.additions}</span>
                        <span class="text-zed-text-tertiary mx-1">/</span>
                        <span class="text-red-400">-{file.deletions}</span>
                      </div>
                    )}
                    {file.status === 'added' && (
                      <div class="text-xs mt-1 font-mono text-green-400">
                        +{file.additions} lines
                      </div>
                    )}
                    {file.status === 'deleted' && (
                      <div class="text-xs mt-1 font-mono text-red-400">
                        -{file.deletions} lines
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg
                    class="w-4 h-4 text-zed-text-tertiary flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
