// File Explorer - Main component for browsing project files

import { createSignal, createEffect, Show } from 'solid-js';

// Per-lane tab selection — persists across lane switches within the session.
// Defaults to 'changes' for any lane that hasn't been visited yet.
const laneTabCache = new Map<string, 'files' | 'changes'>();
import { useFileTree, useFileWatcher } from './hooks';
import { FileTree } from './FileTree';
import { ChangesView } from './ChangesView';
import { OpenFileDialog } from './OpenFileDialog';

interface FileExplorerProps {
  laneId: string;
  baseWorkingDir: string;  // Base project directory (for the header)
  workingDir: string;      // Effective working directory (for file browsing - might be a worktree)
  onFileSelect?: (path: string) => void;
}

export function FileExplorer(props: FileExplorerProps) {
  const [activeTab, setActiveTab] = createSignal<'files' | 'changes'>(
    laneTabCache.get(props.laneId) ?? 'changes'
  );
  const [openFileDialogOpen, setOpenFileDialogOpen] = createSignal(false);

  // Restore the correct tab whenever the active lane changes
  createEffect(() => {
    setActiveTab(laneTabCache.get(props.laneId) ?? 'changes');
  });

  const handleTabChange = (tab: 'files' | 'changes') => {
    laneTabCache.set(props.laneId, tab);
    setActiveTab(tab);
  };

  const tree = useFileTree();

  // Reload file tree when lane or workingDir changes
  createEffect(() => {
    // Track both laneId and workingDir so switching lanes always refreshes
    const _laneId = props.laneId;
    const dir = props.workingDir;
    tree.reset();
    tree.loadDirectory(dir);
  });

  // Set up file watching with auto-refresh
  useFileWatcher({
    workingDir: () => props.workingDir,
    expandedDirs: tree.expandedDirs,
    onRefreshNeeded: (dirPath) => tree.refreshDirectory(dirPath, props.workingDir),
  });

  const handleToggle = (node: Parameters<typeof tree.toggleNode>[0], path: number[]) => {
    tree.toggleNode(node, path, props.onFileSelect);
  };

  const getProjectName = () => {
    const parts = props.baseWorkingDir.split('/');
    return parts[parts.length - 1] || 'Project';
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-panel">
      {/* Tabs */}
      <Tabs activeTab={activeTab()} onTabChange={handleTabChange} />

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Show when={activeTab() === 'files'}>
          <div class="px-2 py-2">
            <ProjectHeader name={getProjectName()} />

            <Show when={tree.isLoading()}>
              <div class="px-4 py-2 text-xs text-zed-text-tertiary">Loading...</div>
            </Show>

            <Show when={tree.error()}>
              <div class="px-4 py-2 text-xs text-zed-accent-red">{tree.error()}</div>
            </Show>

            <Show when={!tree.isLoading() && !tree.error()}>
              <FileTree
                nodes={tree.nodes()}
                selectedPath={tree.selectedPath()}
                onToggle={handleToggle}
              />
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'changes'}>
          <ChangesView
            laneId={props.laneId}
            workingDir={props.workingDir}
            onFileSelect={props.onFileSelect}
          />
        </Show>
      </div>

      {/* Open File button — always visible at the bottom of the Files tab panel */}
      <div class="shrink-0 border-t border-zed-border-subtle p-2">
        <button
          class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zed-text-secondary hover:text-zed-text-primary bg-zed-bg-hover hover:bg-zed-bg-surface border border-zed-border-subtle rounded transition-colors cursor-pointer select-none"
          onClick={() => setOpenFileDialogOpen(true)}
          title="Open a file by path"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          Open File
        </button>
      </div>

      <OpenFileDialog
        open={openFileDialogOpen()}
        onOpenChange={setOpenFileDialogOpen}
        onFileOpen={(path) => props.onFileSelect?.(path)}
      />
    </div>
  );
}

// Sub-components

function Tabs(props: { activeTab: string; onTabChange: (tab: 'files' | 'changes') => void }) {
  const tabClass = (tab: string) =>
    `flex-1 px-4 py-2 text-xs font-medium transition-colors ${
      props.activeTab === tab
        ? 'text-zed-text-primary border-b-2 border-zed-accent-blue'
        : 'text-zed-text-tertiary hover:text-zed-text-secondary'
    }`;

  return (
    <div class="flex border-b border-zed-border-subtle">
      <button class={tabClass('files')} onClick={() => props.onTabChange('files')}>
        Files
      </button>
      <button class={tabClass('changes')} onClick={() => props.onTabChange('changes')}>
        Changes
      </button>
    </div>
  );
}

function ProjectHeader(props: { name: string }) {
  return (
    <div class="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-zed-text-secondary uppercase">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
      {props.name}
    </div>
  );
}

