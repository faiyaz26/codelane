import { Show, createSignal, createEffect } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { isMacOS } from '../../lib/platform';
import { initGitRepo } from '../../lib/git-api';
import { useGitService } from '../../hooks/useGitService';
import { CommitDialog } from '../git';
import { ActivityView } from './ActivityBar';
import { editorStateManager } from '../../services/EditorStateManager';
import { aiReviewService, type AITool } from '../../services/AIReviewService';
import { codeReviewStore } from '../../services/CodeReviewStore';

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

interface TopBarProps {
  activeLaneId?: string;
  activeLaneName?: string;
  effectiveWorkingDir?: string;
  activeView?: ActivityView;
  onNavigateToCodeReview?: () => void;
  onRefreshCodeReview?: () => void;
}

export function TopBar(props: TopBarProps) {
  const [isInitializing, setIsInitializing] = createSignal(false);
  const [commitDialogOpen, setCommitDialogOpen] = createSignal(false);
  const [isGeneratingReview, setIsGeneratingReview] = createSignal(false);
  const [branchName, setBranchName] = createSignal<string | null>(null);
  const [worktreeName, setWorktreeName] = createSignal<string | null>(null);
  const [projectName, setProjectName] = createSignal<string | null>(null);

  // Use centralized git watcher service (shared with ChangesView)
  const gitWatcher = useGitService({
    laneId: () => props.activeLaneId,
    workingDir: () => props.effectiveWorkingDir,
  });

  // Fetch branch, worktree, and project info when working directory changes
  createEffect(async () => {
    const workingDir = props.effectiveWorkingDir;
    if (!workingDir) {
      setBranchName(null);
      setWorktreeName(null);
      setProjectName(null);
      return;
    }

    // Extract project name from path (last segment of main working directory)
    const pathParts = workingDir.split('/');
    const rawProjectName = pathParts[pathParts.length - 1];
    // Capitalize first character
    const capitalizedName = rawProjectName.charAt(0).toUpperCase() + rawProjectName.slice(1);
    setProjectName(capitalizedName);

    // Fetch branch info
    try {
      const branch = await invoke<GitBranchInfo>('git_branch', {
        path: workingDir,
      });
      setBranchName(branch.current);
    } catch (error) {
      console.error('Failed to load branch info:', error);
      setBranchName(null);
    }

    // Fetch worktree info
    try {
      const worktrees = await invoke<WorktreeInfo[]>('git_worktree_list', {
        path: workingDir,
      });
      // Find the worktree that matches the current working directory
      const currentWorktree = worktrees.find(wt =>
        workingDir.startsWith(wt.path) || wt.path.startsWith(workingDir)
      );
      if (currentWorktree && !currentWorktree.is_main) {
        // Extract worktree name from path (last segment)
        const wtPathParts = currentWorktree.path.split('/');
        setWorktreeName(wtPathParts[wtPathParts.length - 1]);
      } else {
        setWorktreeName(null);
      }
    } catch (error) {
      console.error('Failed to load worktree info:', error);
      setWorktreeName(null);
    }
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

  const handleGenerateAIReview = async () => {
    if (!props.activeLaneId || !props.effectiveWorkingDir) return;

    setIsGeneratingReview(true);

    try {
      // Get AI tool and model from localStorage
      const tool = (localStorage.getItem('codelane:aiTool') || 'claude') as AITool;
      const model = localStorage.getItem(`codelane:aiModel:${tool}`) || undefined;

      // Get list of changed files
      const status = gitWatcher.gitStatus();
      if (!status) {
        throw new Error('No git status available');
      }

      // Collect all changed files
      const changedFiles = [
        ...status.staged.map(f => f.path),
        ...status.unstaged.map(f => f.path),
      ];

      let diffContent = '';

      // Get diffs for all files
      for (const filePath of changedFiles) {
        try {
          const diff = await invoke<string>('git_diff', {
            path: props.effectiveWorkingDir,
            file: filePath,
            staged: false,
          });
          diffContent += `\n\n# File: ${filePath}\n${diff}`;
        } catch (error) {
          console.error(`Failed to get diff for ${filePath}:`, error);
        }
      }

      // Generate review with selected model
      const result = await aiReviewService.generateReview({
        tool,
        diffContent,
        workingDir: props.effectiveWorkingDir,
        model,
      });

      // Open result in temporary markdown file
      const content = result.success
        ? result.content
        : `# Error\n\n${result.error || 'Failed to generate review'}`;

      const timestamp = new Date().toLocaleString();
      const title = `AI Summary - ${timestamp}.md`;

      await editorStateManager.openTemporaryMarkdown(props.activeLaneId, title, content);
    } catch (error) {
      // Open error in temporary markdown file
      if (props.activeLaneId) {
        await editorStateManager.openTemporaryMarkdown(
          props.activeLaneId,
          'AI Summary - Error.md',
          `# Error\n\n${error}`
        );
      }
    } finally {
      setIsGeneratingReview(false);
    }
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
            <span class="font-medium text-zed-text-primary">{props.activeLaneName}</span>
            <Show when={branchName()}>
              <span class="text-zed-text-tertiary">|</span>
              <span class="text-zed-text-secondary">{branchName()}</span>
            </Show>
            <Show when={worktreeName()}>
              <span class="text-zed-text-tertiary">|</span>
              <span class="text-zed-text-secondary">{worktreeName()}</span>
            </Show>
            <Show when={projectName()}>
              <span class="text-zed-text-tertiary">|</span>
              <span
                class="text-zed-text-tertiary cursor-default"
                title={props.effectiveWorkingDir}
              >
                {projectName()}
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
                <span class="px-4 py-1.5 text-xs text-zed-text-tertiary">No changes yet</span>
              }
            >
              {/* Show "Review Changes" button when NOT in Git Manager tab */}
              <Show when={props.activeView !== ActivityView.GitManager}>
                <button
                  class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-primary hover:bg-zed-bg-active rounded-md transition-colors"
                  onClick={() => props.onNavigateToCodeReview?.()}
                  title="Open Git Manager tab"
                >
                  Review Changes
                </button>
              </Show>

              {/* Show "Review Changes" button when NOT in Code Review tab */}
              <Show when={props.activeView !== ActivityView.CodeReview && props.activeView !== ActivityView.GitManager}>
                <button
                  class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-primary hover:bg-zed-bg-active rounded-md transition-colors"
                  onClick={() => props.onNavigateToCodeReview?.()}
                  title="Open Code Review tab"
                >
                  Review Changes
                </button>
              </Show>

              {/* Show "Generate AI Review" and "Commit" buttons when IN Code Review tab */}
              <Show when={props.activeView === ActivityView.CodeReview}>
                {(() => {
                  const reviewState = () => codeReviewStore.getState(props.activeLaneId!)();
                  const isGenerating = () => reviewState().status === 'loading';
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

              {/* Show "AI Summary" and "Commit" buttons when IN Git Manager tab */}
              <Show when={props.activeView === ActivityView.GitManager}>
                <button
                  onClick={handleGenerateAIReview}
                  disabled={isGeneratingReview()}
                  class="px-4 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  title="Generate AI summary"
                >
                  {isGeneratingReview() ? '🤖 Generating...' : '🤖 AI Summary'}
                </button>
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
