import { createSignal, For, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { useGitChanges } from '../../hooks/useGitChanges';
import { editorStateManager } from '../../services/EditorStateManager';
import { reviewAPI } from '../../services/api/provider';
import type { FileChangeStats } from '../../types/git';

interface GitBranchInfo {
  current: string | null;
  branches: string[];
}

interface WorktreeInfo {
  path: string;
  head: string;
  branch: string | null;
  is_main: boolean;
}

export type FileSortOrder = 'alphabetical' | 'smart' | 'smart-dependencies' | 'change-size' | 'none';

interface GitCommit {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

interface CodeReviewChangesProps {
  laneId: string;
  workingDir: string;
  onFileSelect?: (path: string) => void;
}

export function CodeReviewChanges(props: CodeReviewChangesProps) {
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [sortOrder, setSortOrder] = createSignal<FileSortOrder>('smart');
  const [sortedFiles, setSortedFiles] = createSignal<FileChangeStats[]>([]);
  const [selectedCommit, setSelectedCommit] = createSignal<GitCommit | null>(null);
  const [commits, setCommits] = createSignal<GitCommit[]>([]);
  const [splitPosition, setSplitPosition] = createSignal(60); // % for top panel
  const [isResizing, setIsResizing] = createSignal(false);
  const [branchInfo, setBranchInfo] = createSignal<GitBranchInfo | null>(null);
  const [worktreeName, setWorktreeName] = createSignal<string | null>(null);

  // Watch for git changes (auto-refreshes when files change)
  const gitChanges = useGitChanges({
    laneId: props.laneId,
    workingDir: props.workingDir,
  });

  // Load commits on mount
  onMount(async () => {
    const saved = localStorage.getItem('codelane:fileSortOrder');
    if (saved && ['alphabetical', 'smart', 'smart-dependencies', 'change-size', 'none'].includes(saved)) {
      setSortOrder(saved as FileSortOrder);
    }

    // Listen for sort order changes from settings
    const handleSortOrderChange = (event: CustomEvent<FileSortOrder>) => {
      setSortOrder(event.detail);
    };
    window.addEventListener('fileSortOrderChanged', handleSortOrderChange as EventListener);

    // Load commit history
    try {
      const commitHistory = await invoke<GitCommit[]>('git_log', {
        path: props.workingDir,
        count: 50,
      });
      setCommits(commitHistory);
    } catch (error) {
      console.error('Failed to load commit history:', error);
    }

    // Load branch info
    try {
      const branch = await invoke<GitBranchInfo>('git_branch', {
        path: props.workingDir,
      });
      setBranchInfo(branch);
    } catch (error) {
      console.error('Failed to load branch info:', error);
    }

    // Load worktree info
    try {
      const worktrees = await invoke<WorktreeInfo[]>('git_worktree_list', {
        path: props.workingDir,
      });
      // Find the worktree that matches the current working directory
      const currentWorktree = worktrees.find(wt =>
        props.workingDir.startsWith(wt.path) || wt.path.startsWith(props.workingDir)
      );
      if (currentWorktree && !currentWorktree.is_main) {
        // Extract worktree name from path (last segment)
        const pathParts = currentWorktree.path.split('/');
        setWorktreeName(pathParts[pathParts.length - 1]);
      }
    } catch (error) {
      console.error('Failed to load worktree info:', error);
    }

    onCleanup(() => {
      window.removeEventListener('fileSortOrderChanged', handleSortOrderChange as EventListener);
    });
  });

  // Sort files whenever changes or sort order updates
  createEffect(async () => {
    const commit = selectedCommit();

    // If a commit is selected, get its changes
    if (commit) {
      try {
        const commitChanges = await invoke<FileChangeStats[]>('git_commit_changes', {
          path: props.workingDir,
          commitHash: commit.hash,
        });

        // Sort the commit changes
        const sorted = await reviewAPI.sortFiles({
          files: commitChanges,
          sortOrder: sortOrder(),
          workingDir: props.workingDir,
        });
        setSortedFiles(sorted);
      } catch (error) {
        console.error('Failed to load commit changes:', error);
        setSortedFiles([]);
      }
      return;
    }

    // Otherwise show uncommitted changes
    const files = gitChanges.changes();
    const order = sortOrder();

    if (files.length === 0) {
      setSortedFiles([]);
      return;
    }

    try {
      const sorted = await reviewAPI.sortFiles({
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
    // Pass commit hash if a commit is selected, otherwise show uncommitted changes
    const commit = selectedCommit();
    await editorStateManager.openFileDiff(
      props.laneId,
      file.path,
      props.workingDir,
      commit?.hash
    );
  };

  const handleCommitClick = (commit: GitCommit) => {
    setSelectedCommit(commit);
    setSelectedFile(null);
  };

  const handleShowUncommitted = () => {
    setSelectedCommit(null);
    setSelectedFile(null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing()) return;

    const container = document.getElementById('split-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newPosition = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp between 30% and 80%
    if (newPosition >= 30 && newPosition <= 80) {
      setSplitPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

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

  const totalAdditions = () => sortedFiles().reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = () => sortedFiles().reduce((sum, f) => sum + f.deletions, 0);
  const fileCount = () => sortedFiles().length;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

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
    <div id="split-container" class="flex flex-col h-full overflow-hidden">
      {/* Top Panel: File Changes */}
      <div class="flex flex-col overflow-hidden" style={{ height: `${splitPosition()}%` }}>
        {/* Branch & Worktree Info */}
        <Show when={branchInfo()?.current || worktreeName()}>
          <div class="px-3 py-1.5 border-b border-zed-border-subtle bg-zed-bg-app flex items-center gap-2 flex-shrink-0">
            <Show when={branchInfo()?.current}>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="6" r="3" stroke-width="2" />
                  <path d="M5 9v12" stroke-width="2" />
                  <circle cx="19" cy="18" r="3" stroke-width="2" />
                  <path d="m15 9l-3-3l3-3" stroke-width="2" />
                  <path d="M12 6h5a2 2 0 0 1 2 2v7" stroke-width="2" />
                </svg>
                <span class="truncate max-w-[120px]">{branchInfo()!.current}</span>
              </span>
            </Show>
            <Show when={worktreeName()}>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span class="truncate max-w-[120px]">{worktreeName()}</span>
              </span>
            </Show>
          </div>
        </Show>

        {/* Summary Header */}
        <div class="px-3 py-2 border-b border-zed-border-subtle bg-zed-bg-panel flex-shrink-0">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <div class="text-xs text-zed-text-tertiary">
                <Show when={!gitChanges.isLoading()} fallback={<span>Loading...</span>}>
                  {fileCount()} {fileCount() === 1 ? 'file' : 'files'} changed
                </Show>
              </div>
              {/* Show Uncommitted Button */}
              <Show when={selectedCommit()}>
                <button
                  onClick={handleShowUncommitted}
                  class="px-2 py-0.5 text-xs bg-zed-accent-blue text-white rounded hover:bg-zed-accent-blue/80 transition-colors"
                  title="Show uncommitted changes"
                >
                  Show Uncommitted
                </button>
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
            when={!gitChanges.isLoading() || selectedCommit()}
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
                    class={`w-full flex items-start gap-2 px-2 py-1.5 hover:bg-zed-bg-hover transition-colors text-left border-b border-zed-border-subtle/50 ${
                      selectedFile() === file.path ? 'bg-zed-bg-hover' : ''
                    }`}
                  >
                    {/* Status Badge */}
                    <div
                      class={`w-4 h-4 flex items-center justify-center text-xs font-bold rounded flex-shrink-0 ${getStatusColor(
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
                        <div class="text-xs text-zed-text-tertiary truncate">
                          {getFilePath(file.path)}
                        </div>
                      )}
                      {file.status !== 'deleted' && file.status !== 'added' && (
                        <div class="text-xs font-mono">
                          <span class="text-green-400">+{file.additions}</span>
                          <span class="text-zed-text-tertiary mx-1">/</span>
                          <span class="text-red-400">-{file.deletions}</span>
                        </div>
                      )}
                      {file.status === 'added' && (
                        <div class="text-xs font-mono text-green-400">
                          +{file.additions} lines
                        </div>
                      )}
                      {file.status === 'deleted' && (
                        <div class="text-xs font-mono text-red-400">
                          -{file.deletions} lines
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg
                      class="w-3 h-3 text-zed-text-tertiary flex-shrink-0 mt-0.5"
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

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        class="h-1 bg-zed-border-default hover:bg-zed-accent-blue cursor-ns-resize flex-shrink-0 transition-colors"
        classList={{
          'bg-zed-accent-blue': isResizing(),
        }}
      />

      {/* Bottom Panel: Commit History */}
      <div class="flex flex-col overflow-hidden" style={{ height: `${100 - splitPosition()}%` }}>
        {/* Commit History Header */}
        <div class="px-3 py-2 border-b border-zed-border-subtle bg-zed-bg-panel flex-shrink-0">
          <div class="text-xs font-medium text-zed-text-primary">Commit History</div>
        </div>

        {/* Commit List */}
        <div class="flex-1 overflow-y-auto">
          <Show
            when={commits().length > 0}
            fallback={
              <div class="p-4 text-center text-zed-text-tertiary text-sm">
                No commits found
              </div>
            }
          >
            <For each={commits()}>
              {(commit) => (
                <button
                  onClick={() => handleCommitClick(commit)}
                  class={`w-full flex flex-col gap-1 px-2 py-1.5 hover:bg-zed-bg-hover transition-colors text-left border-b border-zed-border-subtle/50 ${
                    selectedCommit()?.hash === commit.hash ? 'bg-zed-bg-hover border-l-2 border-l-zed-accent-blue' : ''
                  }`}
                >
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-zed-text-tertiary">{commit.short_hash}</span>
                    <span class="text-xs text-zed-text-primary font-medium truncate flex-1">
                      {commit.message}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-zed-text-tertiary">
                    <span class="truncate">{commit.author}</span>
                    <span>•</span>
                    <span>{formatDate(commit.date)}</span>
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}
