import { createSignal, createEffect, For, Show, onCleanup, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { fileWatchService, type FileWatchEvent } from '../../services/FileWatchService';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number | null;
  modified: number | null;
}

interface FileExplorerProps {
  workingDir: string;
  onFileSelect?: (path: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface TreeNode {
  entry: FileEntry;
  children: TreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
}

export function FileExplorer(props: FileExplorerProps) {
  const [activeTab, setActiveTab] = createSignal<'files' | 'changes'>('files');
  const [rootNodes, setRootNodes] = createSignal<TreeNode[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);

  // Track expanded directories for targeted refresh
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set());

  // Debounce timer for file watch events
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  const pendingRefreshDirs = new Set<string>();

  // Load root directory
  createEffect(() => {
    loadDirectory(props.workingDir);
  });

  // Subscribe to file watch events
  onMount(async () => {
    const unsubscribe = await fileWatchService.watchDirectory(
      props.workingDir,
      (event: FileWatchEvent) => {
        // Get parent directory of the changed file
        const parentDir = getParentPath(event.path);

        // Only refresh if the parent is expanded or is the root
        if (parentDir === props.workingDir || expandedDirs().has(parentDir)) {
          pendingRefreshDirs.add(parentDir);

          // Debounce: wait 100ms before refreshing to batch rapid changes
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
          }
          refreshTimeout = setTimeout(() => {
            const dirsToRefresh = [...pendingRefreshDirs];
            pendingRefreshDirs.clear();

            for (const dir of dirsToRefresh) {
              refreshDirectory(dir);
            }
          }, 100);
        }
      }
    );

    onCleanup(() => {
      unsubscribe();
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    });
  });

  // Get parent path from a file path
  const getParentPath = (filePath: string): string => {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
  };

  // Refresh a specific directory (or root if it's the working dir)
  const refreshDirectory = async (dirPath: string) => {
    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path: dirPath });

      const sorted = entries.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });

      const filtered = sorted.filter((e) => !e.name.startsWith('.'));

      const newNodes = filtered.map((entry) => ({
        entry,
        children: [],
        isExpanded: false,
        isLoading: false,
      }));

      if (dirPath === props.workingDir) {
        // Refresh root - preserve expanded state where possible
        setRootNodes((oldNodes) => {
          // Preserve expanded state for directories that still exist
          const expandedPaths = new Set(
            oldNodes.filter(n => n.isExpanded).map(n => n.entry.path)
          );

          return newNodes.map(node => ({
            ...node,
            isExpanded: expandedPaths.has(node.entry.path),
            // Preserve children if expanded (will be refreshed separately if needed)
            children: expandedPaths.has(node.entry.path)
              ? (oldNodes.find(n => n.entry.path === node.entry.path)?.children || [])
              : [],
          }));
        });
      } else {
        // Refresh subdirectory
        updateNodeByPath(dirPath, { children: newNodes });
      }
    } catch (err) {
      console.error('Failed to refresh directory:', dirPath, err);
    }
  };

  // Update a node by its file path
  const updateNodeByPath = (targetPath: string, updates: Partial<TreeNode>) => {
    setRootNodes((nodes) => {
      return updateNodeRecursive(nodes, targetPath, updates);
    });
  };

  const updateNodeRecursive = (
    nodes: TreeNode[],
    targetPath: string,
    updates: Partial<TreeNode>
  ): TreeNode[] => {
    return nodes.map((node) => {
      if (node.entry.path === targetPath) {
        return { ...node, ...updates };
      }
      if (node.children.length > 0 && targetPath.startsWith(node.entry.path + '/')) {
        return {
          ...node,
          children: updateNodeRecursive(node.children, targetPath, updates),
        };
      }
      return node;
    });
  };

  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path });

      // Sort: directories first, then alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });

      // Filter hidden files (files starting with .)
      const filtered = sorted.filter((e) => !e.name.startsWith('.'));

      setRootNodes(
        filtered.map((entry) => ({
          entry,
          children: [],
          isExpanded: false,
          isLoading: false,
        }))
      );
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = async (node: TreeNode, path: number[]) => {
    if (!node.entry.is_dir) {
      // File selected
      setSelectedPath(node.entry.path);
      props.onFileSelect?.(node.entry.path);
      return;
    }

    // Toggle directory
    if (node.isExpanded) {
      // Collapse - remove from expanded set
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.delete(node.entry.path);
        return next;
      });
      updateNode(path, { isExpanded: false });
    } else {
      // Expand - add to expanded set
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.add(node.entry.path);
        return next;
      });
      // Expand and load children
      updateNode(path, { isLoading: true, isExpanded: true });

      try {
        const entries = await invoke<FileEntry[]>('list_directory', { path: node.entry.path });

        const sorted = entries.sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });

        const filtered = sorted.filter((e) => !e.name.startsWith('.'));

        const children = filtered.map((entry) => ({
          entry,
          children: [],
          isExpanded: false,
          isLoading: false,
        }));

        updateNode(path, { children, isLoading: false });
      } catch (err) {
        console.error('Failed to load directory:', err);
        updateNode(path, { isLoading: false, isExpanded: false });
      }
    }
  };

  const updateNode = (path: number[], updates: Partial<TreeNode>) => {
    setRootNodes((nodes) => {
      const newNodes = [...nodes];
      let current = newNodes;
      let target: TreeNode | undefined;

      for (let i = 0; i < path.length; i++) {
        if (i === path.length - 1) {
          target = current[path[i]];
          current[path[i]] = { ...target, ...updates };
        } else {
          const node = current[path[i]];
          const newChildren = [...node.children];
          current[path[i]] = { ...node, children: newChildren };
          current = newChildren;
        }
      }

      return newNodes;
    });
  };

  const getProjectName = () => {
    const parts = props.workingDir.split('/');
    return parts[parts.length - 1] || 'Project';
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-panel">
      {/* Header */}
      <div class="px-4 py-3 border-b border-zed-border-subtle flex items-center justify-between">
        <span class="text-xs font-semibold text-zed-text-secondary uppercase tracking-wide">Explorer</span>
        <button
          class="text-zed-text-tertiary hover:text-zed-text-primary transition-colors p-0.5 rounded hover:bg-zed-bg-hover"
          onClick={() => props.onToggleCollapse?.()}
          title="Collapse explorer"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-zed-border-subtle">
        <button
          class={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab() === 'files'
              ? 'text-zed-text-primary border-b-2 border-zed-accent-blue'
              : 'text-zed-text-tertiary hover:text-zed-text-secondary'
          }`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button
          class={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            activeTab() === 'changes'
              ? 'text-zed-text-primary border-b-2 border-zed-accent-blue'
              : 'text-zed-text-tertiary hover:text-zed-text-secondary'
          }`}
          onClick={() => setActiveTab('changes')}
        >
          Changes
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Show when={activeTab() === 'files'}>
          {/* Project Root */}
          <div class="px-2 py-2">
            <div class="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-zed-text-secondary uppercase">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              {getProjectName()}
            </div>

            <Show when={isLoading()}>
              <div class="px-4 py-2 text-xs text-zed-text-tertiary">Loading...</div>
            </Show>

            <Show when={error()}>
              <div class="px-4 py-2 text-xs text-zed-accent-red">{error()}</div>
            </Show>

            <Show when={!isLoading() && !error()}>
              <FileTree
                nodes={rootNodes()}
                selectedPath={selectedPath()}
                onToggle={toggleNode}
                depth={0}
                path={[]}
              />
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'changes'}>
          <div class="px-4 py-8 text-center text-xs text-zed-text-tertiary">
            <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </Show>
      </div>
    </div>
  );
}

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onToggle: (node: TreeNode, path: number[]) => void;
  depth: number;
  path: number[];
}

function FileTree(props: FileTreeProps) {
  return (
    <div class="select-none">
      <For each={props.nodes}>
        {(node, index) => (
          <FileTreeItem
            node={node}
            selectedPath={props.selectedPath}
            onToggle={props.onToggle}
            depth={props.depth}
            path={[...props.path, index()]}
          />
        )}
      </For>
    </div>
  );
}

interface FileTreeItemProps {
  node: TreeNode;
  selectedPath: string | null;
  onToggle: (node: TreeNode, path: number[]) => void;
  depth: number;
  path: number[];
}

function FileTreeItem(props: FileTreeItemProps) {
  const isSelected = () => props.selectedPath === props.node.entry.path;

  const getFileIcon = (entry: FileEntry) => {
    if (entry.is_dir) {
      return props.node.isExpanded ? (
        <svg class="w-4 h-4 text-zed-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
        </svg>
      ) : (
        <svg class="w-4 h-4 text-zed-accent-yellow" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }

    // File icons based on extension
    const ext = entry.name.split('.').pop()?.toLowerCase();

    if (['ts', 'tsx'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-accent-blue text-xs font-bold flex items-center justify-center">TS</span>;
    }
    if (['js', 'jsx'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-accent-yellow text-xs font-bold flex items-center justify-center">JS</span>;
    }
    if (['json'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-accent-yellow text-xs font-bold flex items-center justify-center">{'{}'}</span>;
    }
    if (['md'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-text-secondary text-xs font-bold flex items-center justify-center">M</span>;
    }
    if (['css', 'scss'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-accent-purple text-xs font-bold flex items-center justify-center">#</span>;
    }
    if (['rs'].includes(ext || '')) {
      return <span class="w-4 h-4 text-zed-accent-orange text-xs font-bold flex items-center justify-center">Rs</span>;
    }

    return (
      <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  return (
    <>
      <div
        class={`flex items-center gap-1 px-2 py-0.5 cursor-pointer rounded-sm transition-colors ${
          isSelected()
            ? 'bg-zed-bg-active text-zed-text-primary'
            : 'hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary'
        }`}
        style={{ 'padding-left': `${props.depth * 12 + 8}px` }}
        onClick={() => props.onToggle(props.node, props.path)}
      >
        {/* Expand/collapse arrow for directories */}
        <Show when={props.node.entry.is_dir}>
          <svg
            class={`w-3 h-3 text-zed-text-tertiary transition-transform ${props.node.isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </Show>
        <Show when={!props.node.entry.is_dir}>
          <span class="w-3" />
        </Show>

        {/* Icon */}
        {getFileIcon(props.node.entry)}

        {/* Name */}
        <span class="text-sm truncate flex-1">{props.node.entry.name}</span>

        {/* Loading indicator */}
        <Show when={props.node.isLoading}>
          <svg class="w-3 h-3 animate-spin text-zed-text-tertiary" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </Show>
      </div>

      {/* Children */}
      <Show when={props.node.isExpanded && props.node.children.length > 0}>
        <FileTree
          nodes={props.node.children}
          selectedPath={props.selectedPath}
          onToggle={props.onToggle}
          depth={props.depth + 1}
          path={props.path}
        />
      </Show>
    </>
  );
}
