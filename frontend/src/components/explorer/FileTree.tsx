// File tree rendering components

import { For, Show } from 'solid-js';
import type { TreeNode } from './types';
import { FileIcon } from './FileIcon';

interface FileTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onToggle: (node: TreeNode, path: number[]) => void;
  depth?: number;
  path?: number[];
}

export function FileTree(props: FileTreeProps) {
  const depth = props.depth ?? 0;
  const path = props.path ?? [];

  return (
    <div class="select-none">
      <For each={props.nodes}>
        {(node, index) => (
          <FileTreeItem
            node={node}
            selectedPath={props.selectedPath}
            onToggle={props.onToggle}
            depth={depth}
            path={[...path, index()]}
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
            class={`w-3 h-3 text-zed-text-tertiary transition-transform ${
              props.node.isExpanded ? 'rotate-90' : ''
            }`}
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
        <FileIcon entry={props.node.entry} isExpanded={props.node.isExpanded} />

        {/* Name */}
        <span class="text-sm truncate flex-1">{props.node.entry.name}</span>

        {/* Loading indicator */}
        <Show when={props.node.isLoading}>
          <LoadingSpinner />
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

function LoadingSpinner() {
  return (
    <svg class="w-3 h-3 animate-spin text-zed-text-tertiary" viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
        fill="none"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
