import { Show, createSignal, createEffect } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isMacOS } from '../../lib/platform';
import { initGitRepo } from '../../lib/git-api';
import { useGitService } from '../../hooks/useGitService';
import { CommitDialog } from '../git';
import { ActivityView } from './ActivityBar';
import { codeReviewStore } from '../../services/CodeReviewStore';
import GitPullRequestCreateArrowIcon from '../icons/GitPullRequestCreateArrowIcon';
import type { Lane } from '../../types/lane';

interface TopBarProps {
  activeLaneId?: string;
  activeLaneName?: string;
  workingDir?: string;
  effectiveWorkingDir?: string;
  activeView?: ActivityView;
  activeLane?: Lane;
  onNavigateToCodeReview?: () => void;
  onRefreshCodeReview?: () => void;
  onPullPrChanges?: () => void;
}

export function TopBar(props: TopBarProps) {
  const [isInitializing, setIsInitializing] = createSignal(false);
  const [commitDialogOpen, setCommitDialogOpen] = createSignal(false);
  const [projectName, setProjectName] = createSignal<string | null>(null);

  // Use centralized git watcher service (shared with ChangesView)
  const gitWatcher = useGitService({
    laneId: () => props.activeLaneId,
    workingDir: () => props.effectiveWorkingDir,
  });

  // Extract project name from the original working directory (not worktree path)
  createEffect(() => {
    const dir = props.workingDir;
    if (!dir) {
      setProjectName(null);
      return;
    }

    const pathParts = dir.split('/');
    const rawProjectName = pathParts[pathParts.length - 1];
    const capitalizedName = rawProjectName.charAt(0).toUpperCase() + rawProjectName.slice(1);
    setProjectName(capitalizedName);
  });

  const handleInitGit = async () => {
    const dir = props.effectiveWorkingDir;
    if (!dir) return;

    setIsInitializing(true);
    try {
      await initGitRepo(dir);
      // Refresh git status after init
      await gitWatcher.refresh();
    } catch (err) {
      console.error('Failed to initialize git repo:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCommitSuccess = async () => {
    // Refresh git status after commit
    await gitWatcher.refresh();
    // Refresh code review if callback provided
    props.onRefreshCodeReview?.();
  };

  const handleTitleBarMouseDown = async (e: MouseEvent) => {
    // Only trigger drag on the background, not on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-drag]')) {
      return;
    }

    if (e.button === 0) {
      if (e.detail === 2) {
        // Double click - toggle maximize
        const window = getCurrentWindow();
        await window.toggleMaximize();
      } else {
        // Single click - start dragging
        const window = getCurrentWindow();
        await window.startDragging();
      }
    }
  };

  const truncate = (str: string, max: number) => {
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
  };

  return (
    <div class="h-11 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center select-none">
      {/* macOS traffic light spacer (left side) */}
      <Show when={isMacOS()}>
        <div class="w-[78px] flex-shrink-0" data-tauri-drag-region />
      </Show>

      {/* Active lane name with branch/worktree/project info - centered - this area is draggable */}
      <div
        class="flex-1 flex items-center justify-center gap-2"
        data-tauri-drag-region
        onMouseDown={handleTitleBarMouseDown}
      >
        <Show when={props.activeLaneName}>
          <div class="flex items-center gap-2 text-sm" data-tauri-drag-region>
            <span 
              class="font-medium text-zed-text-primary" 
              title={props.activeLaneName}
            >
              {truncate(props.activeLaneName!, 25)}
            </span>
            <Show when={gitWatcher.gitStatus()?.branch}>
              <span class="text-zed-text-tertiary">|</span>
              <span 
                class="text-zed-text-tertiary cursor-default"
                title={gitWatcher.gitStatus()!.branch}
              >
                {truncate(gitWatcher.gitStatus()!.branch!, 20)}
              </span>
            </Show>
            <Show when={projectName()}>
              <span class="text-zed-text-tertiary">|</span>
              <span
                class="text-zed-text-tertiary cursor-default"
                title={props.effectiveWorkingDir}
              >
                {truncate(projectName()!, 20)}
              </span>
            </Show>
          </div>
        </Show>
      </div>

      {/* Git buttons */}
      <Show when={props.effectiveWorkingDir}>
        <div class="flex items-center gap-2 pr-3" data-no-drag>
          <Show
            when={gitWatcher.isRepo() === true}
            fallback={
              <Show when={gitWatcher.isRepo() === false}>
                <button
                  class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-active rounded-md transition-colors disabled:opacity-50"
                  onClick={handleInitGit}
                  disabled={isInitializing()}
                >
                  {isInitializing() ? 'Initializing...' : 'Initialize Git'}
                </button>
              </Show>
            }
          >
            <Show
              when={gitWatcher.hasChanges()}
              fallback={
                <Show
                  when={props.activeLane?.laneType === 'pr_review' || props.activeLane?.prMetadata}
                  fallback={
                    <span class="px-4 py-1.5 text-xs text-zed-text-tertiary">No changes yet</span>
                  }
                >
                  <button
                    class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-primary hover:bg-zed-bg-active rounded-md transition-colors flex items-center gap-1.5"
                    onClick={() => props.onPullPrChanges?.()}
                    title="Pull latest changes for this PR"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Pull Changes
                  </button>
                </Show>
              }
            >
              {/* Show "Review Changes" button when NOT in Code Review tab */}
              <Show when={props.activeView !== ActivityView.CodeReview}>
                <button
                  class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-primary hover:bg-zed-bg-active rounded-md transition-colors flex items-center gap-2"
                  onClick={() => props.onNavigateToCodeReview?.()}
                  title="Open Code Review tab"
                >
                  <GitPullRequestCreateArrowIcon size={16} color="currentColor" strokeWidth={2} />
                  Review Changes
                </button>
              </Show>

              {/* Show "Generate AI Review" and "Commit" buttons when IN Code Review tab */}
              <Show when={props.activeView === ActivityView.CodeReview}>
                {(() => {
                  const reviewState = () => codeReviewStore.getState(props.activeLaneId!)();
                  const isGenerating = () => {
                    const status = reviewState().status;
                    return status !== 'idle' && status !== 'ready' && status !== 'error';
                  };
                  const hasReview = () => reviewState().status === 'ready';

                  return (
                    <>
                      <button
                        onClick={() => {
                          if (hasReview()) {
                            codeReviewStore.reset(props.activeLaneId!);
                          }
                          codeReviewStore.generateReview(props.activeLaneId!, props.effectiveWorkingDir!);
                        }}
                        disabled={isGenerating() || !gitWatcher.hasChanges()}
                        class="px-4 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        title={!gitWatcher.hasChanges() ? 'No changes to review' : hasReview() ? 'Regenerate AI review' : 'Generate AI review'}
                      >
                        {isGenerating() ? 'Generating...' : !gitWatcher.hasChanges() ? 'No Changes' : hasReview() ? 'Regenerate Review' : 'Generate AI Review'}
                      </button>
                      <button
                        class="px-4 py-1.5 text-xs bg-zed-accent-blue text-white rounded-md hover:opacity-90 transition-opacity"
                        onClick={() => setCommitDialogOpen(true)}
                      >
                        Commit
                      </button>
                    </>
                  );
                })()}
              </Show>

              {/* Show only "Commit" button when IN Git Manager tab (AI summary is now part of Review tab) */}
              <Show when={props.activeView === ActivityView.GitManager}>
                <button
                  class="px-4 py-1.5 text-xs bg-zed-accent-blue text-white rounded-md hover:opacity-90 transition-opacity"
                  onClick={() => setCommitDialogOpen(true)}
                >
                  Commit
                </button>
              </Show>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Windows/Linux window controls spacer (right side) */}
      <Show when={!isMacOS()}>
        <div class="w-[138px] flex-shrink-0" data-tauri-drag-region />
      </Show>

      {/* Commit Dialog */}
      <Show when={props.effectiveWorkingDir && props.activeLaneId}>
        <CommitDialog
          open={commitDialogOpen()}
          onOpenChange={setCommitDialogOpen}
          laneId={props.activeLaneId!}
          workingDir={props.effectiveWorkingDir!}
          onCommitSuccess={handleCommitSuccess}
        />
      </Show>
    </div>
  );
}
