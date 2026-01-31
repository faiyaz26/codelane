/**
 * TabBar - Pure UI component for the tab strip
 *
 * Renders tabs with active state, handles clicks, shows create button.
 */

import { Show, For, createSignal } from 'solid-js';
import type { Tab } from '../../types/lane';

interface TabBarProps {
  tabs: Tab[];
  activeTabId?: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onTabCreate: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
  onTabRename?: (tabId: string, newTitle: string) => void;
}

export function TabBar(props: TabBarProps) {
  const [editingTabId, setEditingTabId] = createSignal<string | null>(null);
  const [editingTitle, setEditingTitle] = createSignal('');

  let inputRef: HTMLInputElement | undefined;

  const handleDoubleClick = (tab: Tab) => {
    if (props.onTabRename) {
      setEditingTabId(tab.id);
      setEditingTitle(tab.title);
      // Focus input after render
      setTimeout(() => inputRef?.focus(), 0);
    }
  };

  const handleRenameSubmit = () => {
    const tabId = editingTabId();
    const title = editingTitle().trim();

    if (tabId && title && props.onTabRename) {
      props.onTabRename(tabId, title);
    }

    setEditingTabId(null);
    setEditingTitle('');
  };

  const handleRenameKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingTitle('');
    }
  };

  return (
    <div class="h-10 border-b border-zed-border-subtle flex items-center px-2 gap-1 flex-shrink-0">
      {/* Collapse/Expand Button */}
      <button
        onClick={props.onToggleCollapse}
        class="p-1 rounded hover:bg-zed-bg-hover text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
        title={props.collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <Show
            when={!props.collapsed}
            fallback={
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            }
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </Show>
        </svg>
      </button>

      <div class="h-6 w-px bg-zed-border-default mx-1" />

      {/* Tabs */}
      <Show when={!props.collapsed}>
        <div class="flex-1 flex items-center gap-1 overflow-x-auto">
          <For each={props.tabs}>
            {(tab) => (
              <div
                class={`group flex items-center gap-2 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                  props.activeTabId === tab.id
                    ? 'bg-zed-bg-active text-zed-text-primary'
                    : 'text-zed-text-secondary hover:bg-zed-bg-hover hover:text-zed-text-primary'
                }`}
                onClick={() => props.onTabSelect(tab.id)}
              >
                <Show
                  when={editingTabId() === tab.id}
                  fallback={
                    <span onDblClick={() => handleDoubleClick(tab)}>{tab.title}</span>
                  }
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingTitle()}
                    onInput={(e) => setEditingTitle(e.currentTarget.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={handleRenameKeyDown}
                    class="bg-zed-bg-panel text-zed-text-primary px-1 outline-none border border-zed-accent-blue rounded"
                    style={{ width: '120px' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Show>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onTabClose(tab.id);
                  }}
                  class="opacity-0 group-hover:opacity-100 hover:text-zed-accent-red transition-opacity"
                >
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}
          </For>

          {/* Add Tab Button */}
          <button
            onClick={props.onTabCreate}
            class="p-1 rounded hover:bg-zed-bg-hover text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
            title="New terminal tab"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </Show>
    </div>
  );
}
