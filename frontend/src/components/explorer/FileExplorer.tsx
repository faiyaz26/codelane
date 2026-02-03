// File Explorer - Main component for browsing project files

import { createSignal, createEffect, Show } from 'solid-js';
import { useFileTree, useFileWatcher } from './hooks';
import { FileTree } from './FileTree';

interface FileExplorerProps {
  workingDir: string;
  onFileSelect?: (path: string) => void;
}

export function FileExplorer(props: FileExplorerProps) {
  const [activeTab, setActiveTab] = createSignal<'files' | 'changes'>('files');

  const tree = useFileTree();

  // Load directory and reset state when workingDir changes
  createEffect(() => {
    tree.reset();
    tree.loadDirectory(props.workingDir);
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
    const parts = props.workingDir.split('/');
    return parts[parts.length - 1] || 'Project';
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-panel">
      {/* Tabs */}
      <Tabs activeTab={activeTab()} onTabChange={setActiveTab} />

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
          <EmptyChangesView />
        </Show>
      </div>
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

function EmptyChangesView() {
  return (
    <div class="px-4 py-8 text-center text-xs text-zed-text-tertiary">
      <svg
        class="w-8 h-8 mx-auto mb-2 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p>No changes to display</p>
      <p class="text-zed-text-disabled mt-1">Changes will appear here when you modify files</p>
    </div>
  );
}
