import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { getGitStatus } from '../lib/git-api';
import type { GitStatusResult, FileStatus } from '../types/git';

interface GitStatusProps {
  workingDir: string;
}

export function GitStatus(props: GitStatusProps) {
  const [status, setStatus] = createSignal<GitStatusResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  let refreshInterval: number | undefined;

  const loadStatus = async () => {
    try {
      setError(null);
      const result = await getGitStatus(props.workingDir);
      setStatus(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Don't show error if it's just "not a git repository"
      if (!errorMessage.toLowerCase().includes('not a git repository')) {
        setError(errorMessage);
      }
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    loadStatus();

    // Refresh status every 3 seconds
    refreshInterval = window.setInterval(loadStatus, 3000);
  });

  onCleanup(() => {
    if (refreshInterval !== undefined) {
      clearInterval(refreshInterval);
    }
  });

  const getStatusIcon = (fileStatus: FileStatus) => {
    switch (fileStatus.status) {
      case 'modified':
        return 'M';
      case 'added':
        return 'A';
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

  const getStatusColor = (fileStatus: FileStatus) => {
    switch (fileStatus.status) {
      case 'modified':
        return 'text-zed-accent-yellow';
      case 'added':
        return 'text-zed-accent-green';
      case 'deleted':
        return 'text-zed-accent-red';
      default:
        return 'text-zed-text-secondary';
    }
  };

  const totalChanges = () => {
    const s = status();
    if (!s) return 0;
    return s.staged.length + s.unstaged.length + s.untracked.length;
  };

  return (
    <div class="flex flex-col h-full bg-zed-bg-panel">
      {/* Header */}
      <div class="border-b border-zed-border-subtle px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-zed-text-secondary"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
              clip-rule="evenodd"
            />
          </svg>
          <h3 class="text-sm font-semibold text-zed-text-primary">Source Control</h3>
        </div>

        <Show when={!isLoading()}>
          <button
            class="text-xs text-zed-text-tertiary hover:text-zed-text-primary transition-colors px-2 py-1 rounded hover:bg-zed-bg-hover"
            onClick={loadStatus}
            title="Refresh status"
          >
            ↻ Refresh
          </button>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={!isLoading()}
          fallback={
            <div class="p-4 text-center text-sm text-zed-text-tertiary">
              Loading git status...
            </div>
          }
        >
          <Show
            when={!error() && status()}
            fallback={
              <Show when={error()}>
                <div class="p-4 text-sm text-zed-text-tertiary">
                  <p>Not a git repository</p>
                </div>
              </Show>
            }
          >
            {/* Branch Info */}
            <Show when={status()?.branch}>
              <div class="px-4 py-2 border-b border-zed-border-subtle bg-zed-bg-surface">
                <div class="flex items-center gap-2 text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3 w-3 text-zed-accent-blue"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <span class="font-medium text-zed-text-primary">{status()?.branch}</span>
                </div>
              </div>
            </Show>

            {/* Summary */}
            <div class="px-4 py-2 border-b border-zed-border-subtle">
              <div class="text-xs text-zed-text-secondary">
                <Show
                  when={totalChanges() > 0}
                  fallback={<span>No changes</span>}
                >
                  <span>{totalChanges()} change{totalChanges() !== 1 ? 's' : ''}</span>
                </Show>
              </div>
            </div>

            {/* Staged Changes */}
            <Show when={status()?.staged && status()!.staged.length > 0}>
              <div class="border-b border-zed-border-subtle">
                <div class="px-4 py-2 bg-zed-bg-surface">
                  <h4 class="text-xs font-semibold text-zed-text-secondary uppercase tracking-wide">
                    Staged Changes ({status()!.staged.length})
                  </h4>
                </div>
                <div class="px-2 py-1">
                  <For each={status()!.staged}>
                    {(file) => (
                      <div class="flex items-center gap-2 px-2 py-1 hover:bg-zed-bg-hover rounded text-xs group">
                        <span class={`font-mono font-bold ${getStatusColor(file)}`}>
                          {getStatusIcon(file)}
                        </span>
                        <span class="flex-1 truncate text-zed-text-primary" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Unstaged Changes */}
            <Show when={status()?.unstaged && status()!.unstaged.length > 0}>
              <div class="border-b border-zed-border-subtle">
                <div class="px-4 py-2 bg-zed-bg-surface">
                  <h4 class="text-xs font-semibold text-zed-text-secondary uppercase tracking-wide">
                    Changes ({status()!.unstaged.length})
                  </h4>
                </div>
                <div class="px-2 py-1">
                  <For each={status()!.unstaged}>
                    {(file) => (
                      <div class="flex items-center gap-2 px-2 py-1 hover:bg-zed-bg-hover rounded text-xs group">
                        <span class={`font-mono font-bold ${getStatusColor(file)}`}>
                          {getStatusIcon(file)}
                        </span>
                        <span class="flex-1 truncate text-zed-text-primary" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Untracked Files */}
            <Show when={status()?.untracked && status()!.untracked.length > 0}>
              <div class="border-b border-zed-border-subtle">
                <div class="px-4 py-2 bg-zed-bg-surface">
                  <h4 class="text-xs font-semibold text-zed-text-secondary uppercase tracking-wide">
                    Untracked Files ({status()!.untracked.length})
                  </h4>
                </div>
                <div class="px-2 py-1">
                  <For each={status()!.untracked}>
                    {(file) => (
                      <div class="flex items-center gap-2 px-2 py-1 hover:bg-zed-bg-hover rounded text-xs group">
                        <span class="font-mono font-bold text-zed-text-tertiary">
                          ?
                        </span>
                        <span class="flex-1 truncate text-zed-text-primary" title={file}>
                          {file}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
