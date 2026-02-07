import { createSignal, createEffect, createMemo, For, Show, batch } from 'solid-js';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { FileChangeItem, type FileChangeStatus } from './FileChangeItem';
import { Button } from '../ui/Button';
import { getGitStatus, stageFiles, unstageFiles, createCommit } from '../../lib/git-api';
import { useGitService } from '../../hooks/useGitService';
import type { GitStatusResult } from '../../types/git';
import { isMacOS } from '../../lib/platform';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  laneId: string;
  workingDir: string;
  onCommitSuccess?: () => void;
}

interface FileEntry {
  path: string;
  status: FileChangeStatus;
  category: 'staged' | 'unstaged' | 'untracked';
}

export function CommitDialog(props: CommitDialogProps) {
  const [message, setMessage] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [isCommitting, setIsCommitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [gitStatus, setGitStatus] = createSignal<GitStatusResult | null>(null);
  const [selectedFiles, setSelectedFiles] = createSignal<Set<string>>(new Set());

  // Sections collapsed state
  const [stagedCollapsed, setStagedCollapsed] = createSignal(false);
  const [unstagedCollapsed, setUnstagedCollapsed] = createSignal(false);
  const [untrackedCollapsed, setUntrackedCollapsed] = createSignal(false);

  // Track external git changes while dialog is open
  const [hasExternalChanges, setHasExternalChanges] = createSignal(false);
  const gitService = useGitService({
    laneId: () => props.laneId,
    workingDir: () => props.workingDir,
  });

  // Memoize the shortcut key to avoid recreating on every render
  const shortcutKey = createMemo(() => isMacOS() ? '⌘' : 'Ctrl');

  // Load git status when dialog opens
  createEffect(() => {
    if (props.open && props.workingDir) {
      setHasExternalChanges(false);
      loadGitStatus();
    }
  });

  // Detect external git status changes while dialog is open
  createEffect(() => {
    const externalStatus = gitService.gitStatus();
    if (!props.open || isLoading() || !gitStatus() || !externalStatus) return;

    // Compare total change count - if it differs, something changed externally
    const localTotal = (gitStatus()!.staged.length + gitStatus()!.unstaged.length + gitStatus()!.untracked.length);
    const externalTotal = (externalStatus.staged.length + externalStatus.unstaged.length + externalStatus.untracked.length);

    if (localTotal !== externalTotal) {
      setHasExternalChanges(true);
    }
  });

  const loadGitStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await getGitStatus(props.workingDir);

      // Build the file list and pre-select all files
      const allPaths = new Set<string>();
      for (const file of status.staged) {
        allPaths.add(file.path);
      }
      for (const file of status.unstaged) {
        allPaths.add(file.path);
      }
      for (const path of status.untracked) {
        allPaths.add(path);
      }

      // Use batch to update both at once and avoid intermediate renders
      batch(() => {
        setGitStatus(status);
        setSelectedFiles(allPaths);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const allFiles = createMemo(() => {
    const status = gitStatus();
    if (!status) return [];

    const files: FileEntry[] = [];

    for (const file of status.staged) {
      files.push({
        path: file.path,
        status: file.status as FileChangeStatus,
        category: 'staged',
      });
    }

    for (const file of status.unstaged) {
      files.push({
        path: file.path,
        status: file.status as FileChangeStatus,
        category: 'unstaged',
      });
    }

    for (const path of status.untracked) {
      files.push({
        path,
        status: 'untracked',
        category: 'untracked',
      });
    }

    return files;
  });

  const stagedFiles = createMemo(() => allFiles().filter((f) => f.category === 'staged'));
  const unstagedFiles = createMemo(() => allFiles().filter((f) => f.category === 'unstaged'));
  const untrackedFiles = createMemo(() => allFiles().filter((f) => f.category === 'untracked'));

  const selectedCount = createMemo(() => selectedFiles().size);
  const totalCount = createMemo(() => allFiles().length);
  const allSelected = createMemo(() => selectedCount() === totalCount() && totalCount() > 0);
  const noneSelected = createMemo(() => selectedCount() === 0);

  // Simple local state updates - no git commands
  const selectAll = () => {
    const allPaths = new Set(allFiles().map(f => f.path));
    setSelectedFiles(allPaths);
  };

  const selectNone = () => {
    setSelectedFiles(new Set());
  };

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleCommit = async () => {
    const msg = message().trim();
    if (!msg) {
      setError('Please enter a commit message');
      return;
    }

    const selected = selectedFiles();
    if (selected.size === 0) {
      setError('Please select at least one file to commit');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const status = gitStatus();
      if (!status) {
        throw new Error('No git status available');
      }

      // Determine which files need to be staged/unstaged
      const currentlyStaged = new Set(status.staged.map(f => f.path));
      const toStage: string[] = [];
      const toUnstage: string[] = [];

      // Files that are selected but not staged need to be staged
      for (const path of selected) {
        if (!currentlyStaged.has(path)) {
          toStage.push(path);
        }
      }

      // Files that are staged but not selected need to be unstaged
      for (const path of currentlyStaged) {
        if (!selected.has(path)) {
          toUnstage.push(path);
        }
      }

      // Stage selected files
      if (toStage.length > 0) {
        await stageFiles(props.workingDir, toStage);
      }

      // Unstage unselected files
      if (toUnstage.length > 0) {
        await unstageFiles(props.workingDir, toUnstage);
      }

      // Create the commit
      await createCommit(props.workingDir, msg);

      setMessage('');
      props.onOpenChange(false);
      props.onCommitSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <KobalteDialog open={props.open} onOpenChange={props.onOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content class="relative w-full max-w-xl bg-zed-bg-overlay border border-zed-border-default rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div class="px-5 py-4 border-b border-zed-border-default">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-zed-accent-blue/10">
                  <svg class="w-5 h-5 text-zed-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 class="text-base font-semibold text-zed-text-primary">Create Commit</h2>
                  <Show when={gitStatus()?.branch}>
                    <p class="text-xs text-zed-text-tertiary flex items-center gap-1.5 mt-0.5">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{gitStatus()?.branch}</span>
                    </p>
                  </Show>
                </div>
              </div>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-auto">
              {/* Loading State */}
              <Show when={isLoading()}>
                <div class="flex items-center justify-center py-16">
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-zed-accent-blue/30 border-t-zed-accent-blue rounded-full animate-spin" />
                    <span class="text-sm text-zed-text-tertiary">Loading changes...</span>
                  </div>
                </div>
              </Show>

              {/* External changes notification */}
              <Show when={hasExternalChanges()}>
                <div class="mx-5 mt-4 p-3 rounded-lg bg-zed-accent-blue/10 border border-zed-accent-blue/20 flex items-center justify-between">
                  <p class="text-sm text-zed-accent-blue flex items-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Repository state has changed
                  </p>
                  <button
                    class="px-3 py-1 text-xs font-medium text-zed-accent-blue hover:bg-zed-accent-blue/10 rounded transition-colors"
                    onClick={() => { setHasExternalChanges(false); loadGitStatus(); }}
                  >
                    Refresh
                  </button>
                </div>
              </Show>

              <Show when={!isLoading()}>
                {/* Commit Message */}
                <div class="px-5 py-4">
                  <label class="block text-xs font-medium text-zed-text-secondary mb-2">
                    Commit Message
                  </label>
                  <textarea
                    class="w-full h-24 px-3 py-2.5 text-sm bg-zed-bg-app border border-zed-border-default rounded-lg text-zed-text-primary placeholder-zed-text-disabled resize-none transition-all focus:outline-none focus:border-zed-accent-blue focus:ring-1 focus:ring-zed-accent-blue/30"
                    placeholder="Describe your changes..."
                    value={message()}
                    onInput={(e) => setMessage(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    autocomplete="off"
                    autocorrect="off"
                    spellcheck={false}
                  />
                  <p class="mt-1.5 text-xs text-zed-text-disabled">
                    Press <kbd class="px-1.5 py-0.5 bg-zed-bg-surface rounded text-[10px] font-medium">{shortcutKey()}</kbd> + <kbd class="px-1.5 py-0.5 bg-zed-bg-surface rounded text-[10px] font-medium">Enter</kbd> to commit
                  </p>
                </div>

                {/* File Changes */}
                <div class="border-t border-zed-border-default">
                  {/* Summary bar */}
                  <div class="px-5 py-3 bg-zed-bg-panel/50 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-4">
                      <span class="text-zed-text-secondary">Changes</span>
                      <div class="flex items-center gap-3">
                        <Show when={stagedFiles().length > 0}>
                          <span class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-400" />
                            <span class="text-zed-text-tertiary">{stagedFiles().length} staged</span>
                          </span>
                        </Show>
                        <Show when={unstagedFiles().length > 0}>
                          <span class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-400" />
                            <span class="text-zed-text-tertiary">{unstagedFiles().length} modified</span>
                          </span>
                        </Show>
                        <Show when={untrackedFiles().length > 0}>
                          <span class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-zinc-400" />
                            <span class="text-zed-text-tertiary">{untrackedFiles().length} untracked</span>
                          </span>
                        </Show>
                      </div>
                    </div>
                    <Show when={totalCount() > 0}>
                      <div class="flex items-center gap-1">
                        <button
                          class={`px-2 py-1 rounded text-xs transition-colors ${
                            allSelected()
                              ? 'text-zed-text-disabled cursor-default'
                              : 'text-zed-text-tertiary hover:text-zed-text-primary hover:bg-white/[0.04]'
                          }`}
                          onClick={selectAll}
                          disabled={allSelected()}
                        >
                          Select all
                        </button>
                        <span class="text-zed-border-default">|</span>
                        <button
                          class={`px-2 py-1 rounded text-xs transition-colors ${
                            noneSelected()
                              ? 'text-zed-text-disabled cursor-default'
                              : 'text-zed-text-tertiary hover:text-zed-text-primary hover:bg-white/[0.04]'
                          }`}
                          onClick={selectNone}
                          disabled={noneSelected()}
                        >
                          Select none
                        </button>
                      </div>
                    </Show>
                  </div>

                  {/* File list */}
                  <div class="max-h-56 overflow-y-auto">
                    {/* Staged changes */}
                    <Show when={stagedFiles().length > 0}>
                      <FileSection
                        title="Staged Changes"
                        count={stagedFiles().length}
                        collapsed={stagedCollapsed()}
                        onToggle={() => setStagedCollapsed(!stagedCollapsed())}
                        color="emerald"
                      >
                        <For each={stagedFiles()}>
                          {(file) => (
                            <FileChangeItem
                              path={file.path}
                              status={file.status}
                              checked={selectedFiles().has(file.path)}
                              onToggle={toggleFile}
                            />
                          )}
                        </For>
                      </FileSection>
                    </Show>

                    {/* Unstaged changes */}
                    <Show when={unstagedFiles().length > 0}>
                      <FileSection
                        title="Modified"
                        count={unstagedFiles().length}
                        collapsed={unstagedCollapsed()}
                        onToggle={() => setUnstagedCollapsed(!unstagedCollapsed())}
                        color="amber"
                      >
                        <For each={unstagedFiles()}>
                          {(file) => (
                            <FileChangeItem
                              path={file.path}
                              status={file.status}
                              checked={selectedFiles().has(file.path)}
                              onToggle={toggleFile}
                            />
                          )}
                        </For>
                      </FileSection>
                    </Show>

                    {/* Untracked files */}
                    <Show when={untrackedFiles().length > 0}>
                      <FileSection
                        title="Untracked"
                        count={untrackedFiles().length}
                        collapsed={untrackedCollapsed()}
                        onToggle={() => setUntrackedCollapsed(!untrackedCollapsed())}
                        color="zinc"
                      >
                        <For each={untrackedFiles()}>
                          {(file) => (
                            <FileChangeItem
                              path={file.path}
                              status={file.status}
                              checked={selectedFiles().has(file.path)}
                              onToggle={toggleFile}
                            />
                          )}
                        </For>
                      </FileSection>
                    </Show>

                    {/* Empty state */}
                    <Show when={allFiles().length === 0}>
                      <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="p-3 rounded-full bg-emerald-500/10 mb-3">
                          <svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p class="text-sm text-zed-text-primary font-medium">All clean</p>
                        <p class="text-xs text-zed-text-tertiary mt-1">No changes to commit — your working directory is clean</p>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>

            {/* Error message */}
            <Show when={error()}>
              <div class="mx-5 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p class="text-sm text-red-400 flex items-center gap-2">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error()}
                </p>
              </div>
            </Show>

            {/* Footer */}
            <div class="px-5 py-4 border-t border-zed-border-default bg-zed-bg-panel/30 flex items-center justify-between">
              <Show when={allFiles().length > 0} fallback={
                <div class="flex-1 flex justify-end">
                  <Button variant="secondary" size="md" onClick={() => props.onOpenChange(false)}>
                    Close
                  </Button>
                </div>
              }>
                <div class="text-xs text-zed-text-tertiary">
                  <Show when={selectedCount() > 0}>
                    {selectedCount()} file{selectedCount() !== 1 ? 's' : ''} selected
                  </Show>
                </div>
                <div class="flex items-center gap-3">
                  <Button variant="secondary" size="md" onClick={() => props.onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleCommit}
                    disabled={isCommitting() || !message().trim() || selectedCount() === 0}
                  >
                    {isCommitting() ? (
                      <span class="flex items-center gap-2">
                        <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Committing...
                      </span>
                    ) : (
                      'Commit Changes'
                    )}
                  </Button>
                </div>
              </Show>
            </div>

            {/* Close Button */}
            <KobalteDialog.CloseButton class="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-zed-bg-hover transition-colors">
              <svg class="h-4 w-4 text-zed-text-tertiary hover:text-zed-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </KobalteDialog.CloseButton>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}

// File section component
interface FileSectionProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  color: 'emerald' | 'amber' | 'zinc';
  children: any;
}

function FileSection(props: FileSectionProps) {
  const colorClasses = {
    emerald: 'bg-emerald-400/10 text-emerald-400',
    amber: 'bg-amber-400/10 text-amber-400',
    zinc: 'bg-zinc-400/10 text-zinc-400',
  };

  return (
    <div class="border-b border-zed-border-subtle last:border-b-0">
      <button
        class="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-white/[0.02] transition-colors"
        onClick={props.onToggle}
      >
        <svg
          class={`w-3.5 h-3.5 text-zed-text-tertiary transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-xs font-medium text-zed-text-secondary">{props.title}</span>
        <span class={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorClasses[props.color]}`}>
          {props.count}
        </span>
      </button>
      <Show when={!props.collapsed}>
        <div class="px-3 pb-2">
          {props.children}
        </div>
      </Show>
    </div>
  );
}
