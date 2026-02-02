// Editor tabs component - file tab bar with horizontal scrolling

import { createSignal, For, Show } from 'solid-js';
import { FileIcon } from './FileIcon';
import type { EditorTab } from './types';

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabs(props: EditorTabsProps) {
  let scrollContainerRef: HTMLDivElement | undefined;
  const [showLeftScroll, setShowLeftScroll] = createSignal(false);
  const [showRightScroll, setShowRightScroll] = createSignal(false);

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
    </div>
  );
}
