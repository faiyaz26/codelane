// Editor tabs component - file tab bar with horizontal scrolling

import { createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { FileIcon } from './FileIcon';
import type { EditorTab } from './types';

interface ContextMenuState {
  x: number;
  y: number;
  tab: EditorTab;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  basePath?: string; // Lane's base path for relative path calculation
}

export function EditorTabs(props: EditorTabsProps) {
  let scrollContainerRef: HTMLDivElement | undefined;
  let contextMenuRef: HTMLDivElement | undefined;
  const [showLeftScroll, setShowLeftScroll] = createSignal(false);
  const [showRightScroll, setShowRightScroll] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState | null>(null);

  // Check scroll position to show/hide scroll indicators
  const updateScrollIndicators = () => {
    if (!scrollContainerRef) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
  };

  // Scroll left/right by a fixed amount
  const scrollBy = (direction: 'left' | 'right') => {
    if (!scrollContainerRef) return;
    const amount = direction === 'left' ? -150 : 150;
    scrollContainerRef.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Get relative path from base path
  const getRelativePath = (absolutePath: string): string => {
    if (!props.basePath) return absolutePath;
    if (absolutePath.startsWith(props.basePath)) {
      const relative = absolutePath.slice(props.basePath.length);
      return relative.startsWith('/') ? relative.slice(1) : relative;
    }
    return absolutePath;
  };

  // Handle right-click on tab
  const handleContextMenu = (e: MouseEvent, tab: EditorTab) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  };

  // Close context menu
  const closeContextMenu = () => setContextMenu(null);

  // Copy path to clipboard
  const copyPath = async (type: 'absolute' | 'relative' | 'filename') => {
    const menu = contextMenu();
    if (!menu) return;

    let textToCopy: string;
    switch (type) {
      case 'absolute':
        textToCopy = menu.tab.path;
        break;
      case 'relative':
        textToCopy = getRelativePath(menu.tab.path);
        break;
      case 'filename':
        textToCopy = menu.tab.name;
        break;
    }

    try {
      await writeText(textToCopy);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
    closeContextMenu();
  };

  // Close context menu on click outside
  const handleClickOutside = (e: MouseEvent) => {
    if (contextMenuRef && !contextMenuRef.contains(e.target as Node)) {
      closeContextMenu();
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <div class="h-9 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center relative">
      {/* Left scroll button */}
      <Show when={showLeftScroll()}>
        <button
          class="absolute left-0 z-10 h-full px-1 bg-gradient-to-r from-zed-bg-panel via-zed-bg-panel to-transparent hover:from-zed-bg-hover hover:via-zed-bg-hover"
          onClick={() => scrollBy('left')}
        >
          <svg class="w-4 h-4 text-zed-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </Show>

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        class="flex-1 flex items-center h-full overflow-x-auto scrollbar-none"
        onScroll={updateScrollIndicators}
        onMouseEnter={updateScrollIndicators}
      >
        <Show
          when={props.tabs.length > 0}
          fallback={
            <div class="px-4 text-xs text-zed-text-tertiary italic">
              No files open
            </div>
          }
        >
          <For each={props.tabs}>
            {(tab) => (
              <div
                class={`group h-full flex items-center gap-2 px-3 border-r border-zed-border-subtle cursor-pointer transition-colors flex-shrink-0 max-w-[200px] ${
                  tab.id === props.activeTabId
                    ? 'bg-zed-bg-surface text-zed-text-primary'
                    : 'text-zed-text-secondary hover:bg-zed-bg-hover hover:text-zed-text-primary'
                }`}
                onClick={() => props.onTabSelect(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                title={tab.path}
              >
                {/* File icon or modified indicator */}
                <Show
                  when={tab.isModified}
                  fallback={<FileIcon filename={tab.name} class="w-4 h-4 flex-shrink-0" />}
                >
                  <span class="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                    <span class="w-2 h-2 rounded-full bg-zed-accent-yellow" title="Unsaved changes" />
                  </span>
                </Show>

                {/* File name */}
                <span class="text-sm truncate">{tab.name}</span>

                {/* Close button */}
                <button
                  class="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-zed-bg-active transition-all flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onTabClose(tab.id);
                  }}
                  title="Close"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Right scroll button */}
      <Show when={showRightScroll()}>
        <button
          class="absolute right-0 z-10 h-full px-1 bg-gradient-to-l from-zed-bg-panel via-zed-bg-panel to-transparent hover:from-zed-bg-hover hover:via-zed-bg-hover"
          onClick={() => scrollBy('right')}
        >
          <svg class="w-4 h-4 text-zed-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </Show>

      {/* Context menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <div
            ref={contextMenuRef}
            class="fixed z-50 bg-zed-bg-panel border border-zed-border-default rounded-md shadow-lg py-1 min-w-[180px]"
            style={{
              left: `${menu().x}px`,
              top: `${menu().y}px`,
            }}
          >
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-zed-text-primary hover:bg-zed-bg-hover flex items-center gap-2"
              onClick={() => copyPath('filename')}
            >
              <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Copy File Name
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-zed-text-primary hover:bg-zed-bg-hover flex items-center gap-2"
              onClick={() => copyPath('relative')}
            >
              <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copy Relative Path
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-zed-text-primary hover:bg-zed-bg-hover flex items-center gap-2"
              onClick={() => copyPath('absolute')}
            >
              <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Copy Absolute Path
            </button>
            <div class="border-t border-zed-border-subtle my-1" />
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-zed-text-primary hover:bg-zed-bg-hover flex items-center gap-2"
              onClick={() => {
                props.onTabClose(menu().tab.id);
                closeContextMenu();
              }}
            >
              <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
