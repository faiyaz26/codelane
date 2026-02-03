// Hook for managing file tree state and operations

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, TreeNode } from '../types';

interface UseFileTreeReturn {
  nodes: () => TreeNode[];
  isLoading: () => boolean;
  error: () => string | null;
  selectedPath: () => string | null;
  expandedDirs: () => Set<string>;
  loadDirectory: (path: string) => Promise<void>;
  refreshDirectory: (dirPath: string, workingDir: string) => Promise<void>;
  toggleNode: (node: TreeNode, path: number[], onFileSelect?: (path: string) => void) => Promise<void>;
  reset: () => void;
}

export function useFileTree(): UseFileTreeReturn {
  const [nodes, setNodes] = createSignal<TreeNode[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set());

  const sortAndFilterEntries = (entries: FileEntry[]): FileEntry[] => {
    return entries
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const entriesToNodes = (entries: FileEntry[]): TreeNode[] => {
    return sortAndFilterEntries(entries).map((entry) => ({
      entry,
      children: [],
      isExpanded: false,
      isLoading: false,
    }));
  };

  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path });
      setNodes(entriesToNodes(entries));
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDirectory = async (dirPath: string, workingDir: string) => {
    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path: dirPath });
      const newNodes = entriesToNodes(entries);

      if (dirPath === workingDir) {
        // Refresh root - preserve expanded state
        setNodes((oldNodes) => {
          const expandedPaths = new Set(
            oldNodes.filter((n) => n.isExpanded).map((n) => n.entry.path)
          );

          return newNodes.map((node) => ({
            ...node,
            isExpanded: expandedPaths.has(node.entry.path),
            children: expandedPaths.has(node.entry.path)
              ? (oldNodes.find((n) => n.entry.path === node.entry.path)?.children || [])
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

  const updateNodeByPath = (targetPath: string, updates: Partial<TreeNode>) => {
    setNodes((currentNodes) => updateNodeRecursive(currentNodes, targetPath, updates));
  };

  const updateNodeRecursive = (
    nodeList: TreeNode[],
    targetPath: string,
    updates: Partial<TreeNode>
  ): TreeNode[] => {
    return nodeList.map((node) => {
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

  const updateNodeByIndex = (path: number[], updates: Partial<TreeNode>) => {
    setNodes((currentNodes) => {
      const newNodes = [...currentNodes];
      let current = newNodes;

      for (let i = 0; i < path.length; i++) {
        if (i === path.length - 1) {
          const target = current[path[i]];
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

  const toggleNode = async (
    node: TreeNode,
    path: number[],
    onFileSelect?: (path: string) => void
  ) => {
    if (!node.entry.is_dir) {
      setSelectedPath(node.entry.path);
      onFileSelect?.(node.entry.path);
      return;
    }

    if (node.isExpanded) {
      // Collapse
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.delete(node.entry.path);
        return next;
      });
      updateNodeByIndex(path, { isExpanded: false });
    } else {
      // Expand
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.add(node.entry.path);
        return next;
      });
      updateNodeByIndex(path, { isLoading: true, isExpanded: true });

      try {
        const entries = await invoke<FileEntry[]>('list_directory', { path: node.entry.path });
        updateNodeByIndex(path, { children: entriesToNodes(entries), isLoading: false });
      } catch (err) {
        console.error('Failed to load directory:', err);
        updateNodeByIndex(path, { isLoading: false, isExpanded: false });
      }
    }
  };

  const reset = () => {
    setNodes([]);
    setExpandedDirs(new Set());
    setSelectedPath(null);
    setError(null);
    setIsLoading(true);
  };

  return {
    nodes,
    isLoading,
    error,
    selectedPath,
    expandedDirs,
    loadDirectory,
    refreshDirectory,
    toggleNode,
    reset,
  };
}
