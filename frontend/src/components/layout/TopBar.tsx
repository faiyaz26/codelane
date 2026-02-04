import { Show, createSignal } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isMacOS } from '../../lib/platform';
import { initGitRepo } from '../../lib/git-api';
import { useGitWatcher } from '../../hooks';
import { CommitDialog } from '../git';

interface TopBarProps {
  activeLaneName?: string;
  effectiveWorkingDir?: string;
}

export function TopBar(props: TopBarProps) {
  const [commitDialogOpen, setCommitDialogOpen] = createSignal(false);
  const [isInitializing, setIsInitializing] = createSignal(false);

  // Use the shared git watcher hook
  const gitWatcher = useGitWatcher({
    workingDir: () => props.effectiveWorkingDir,
    debounceMs: 300,
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
    <div
      class="h-11 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center select-none"
      onMouseDown={handleTitleBarMouseDown}
    >
      {/* macOS traffic light spacer (left side) */}
      <Show when={isMacOS()}>
        <div class="w-[78px] flex-shrink-0" />
      </Show>

      {/* Active lane name - centered */}
      <div class="flex-1 flex items-center justify-center">
        <Show when={props.activeLaneName}>
          <span class="text-sm font-medium text-zed-text-secondary">{props.activeLaneName}</span>
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
              <button
                class="px-4 py-1.5 text-xs bg-zed-bg-hover text-zed-text-tertiary rounded-md cursor-not-allowed"
                disabled
              >
                Review Changes
              </button>
              <button
                class="px-4 py-1.5 text-xs bg-zed-accent-blue text-white rounded-md hover:opacity-90 transition-opacity"
                onClick={() => setCommitDialogOpen(true)}
              >
                Commit
              </button>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Windows/Linux window controls spacer (right side) */}
      <Show when={!isMacOS()}>
        <div class="w-[138px] flex-shrink-0" />
      </Show>

      {/* Commit Dialog */}
      <Show when={props.effectiveWorkingDir}>
        <CommitDialog
          open={commitDialogOpen()}
          onOpenChange={setCommitDialogOpen}
          workingDir={props.effectiveWorkingDir!}
          onCommitSuccess={handleCommitSuccess}
        />
      </Show>
    </div>
  );
}
