import { createSignal, For, Show } from 'solid-js';
import { useGitChanges } from '../../hooks/useGitChanges';
import { editorStateManager } from '../../services/EditorStateManager';
import type { FileChangeStats } from '../../types/git';

interface CodeReviewChangesProps {
  laneId: string;
  workingDir: string;
  onFileSelect?: (path: string) => void;
}

export function CodeReviewChanges(props: CodeReviewChangesProps) {
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);

  // Watch for git changes (auto-refreshes when files change)
  const gitChanges = useGitChanges({
    laneId: props.laneId,
    workingDir: props.workingDir,
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

  const totalAdditions = () => gitChanges.changes().reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = () => gitChanges.changes().reduce((sum, f) => sum + f.deletions, 0);
  const fileCount = () => gitChanges.changes().length;

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Summary Header */}
      <div class="px-3 py-2 border-b border-zed-border-subtle bg-zed-bg-panel">
        <div class="text-xs text-zed-text-tertiary mb-1">
          <Show when={!gitChanges.isLoading()} fallback={<span>Loading...</span>}>
            {fileCount()} {fileCount() === 1 ? 'file' : 'files'} changed
          </Show>
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
            <For each={gitChanges.changes()}>
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
