import { createSignal, Show, For, onMount, onCleanup, createMemo, createEffect } from 'solid-js';
import type { Tab } from '../types/lane';
import { TerminalView } from './TerminalView';
import { getPanelState, setPanelState } from '../lib/storage';

interface BottomPanelProps {
  laneId: string;
  workingDir: string;
  tabs: Tab[];
  activeTabId?: string;
  onTabCreate: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

export function BottomPanel(props: BottomPanelProps) {
  // Load initial state from localStorage
  const initialState = getPanelState(props.laneId);
  const [collapsed, setCollapsed] = createSignal(initialState.collapsed);
  const [height, setHeight] = createSignal(initialState.height);
  const [isResizing, setIsResizing] = createSignal(false);
  const minHeight = 40;
  const maxHeight = () => window.innerHeight * 0.5; // 50% of viewport height

  const panelHeight = () => collapsed() ? minHeight : Math.min(height(), maxHeight());

  // Save to localStorage when state changes
  createEffect(() => {
    setPanelState(props.laneId, {
      collapsed: collapsed(),
      height: height(),
    });
  });

  // Trigger terminal resize when expanding and create tab if none exist
  createEffect((prev) => {
    const isCollapsed = collapsed();
    // If we just expanded (was collapsed, now not)
    if (prev === true && isCollapsed === false) {
      // If there are no tabs, create one
      if (tabs().length === 0) {
        props.onTabCreate();
      }

      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('terminal-resize'));
        // Also dispatch regular resize as backup
        window.dispatchEvent(new Event('resize'));
      });
    }
    return isCollapsed;
  });

  // Memoize tabs to prevent recreation on every prop change
  const tabs = createMemo(() => props.tabs, [], (a, b) => {
    if (a.length !== b.length) return false;
    return a.every((tab, i) => tab.id === b[i]?.id);
  });

  const handleMouseDown = (e: MouseEvent) => {
    if (collapsed()) return;
    setIsResizing(true);
    e.preventDefault();
  };

  const handleToggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing()) return;

    const newHeight = window.innerHeight - e.clientY;
    const clampedHeight = Math.max(minHeight + 100, Math.min(newHeight, maxHeight()));
    setHeight(clampedHeight);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  return (
    <div
      class="border-t border-zed-border-subtle bg-zed-bg-panel flex flex-col"
      style={{
        height: `${panelHeight()}px`,
        transition: isResizing() ? 'none' : 'height 0.2s'
      }}
    >
      {/* Resize Handle */}
      <Show when={!collapsed()}>
        <div
          onMouseDown={handleMouseDown}
          class="h-1 cursor-ns-resize hover:bg-zed-accent-blue/50 active:bg-zed-accent-blue transition-colors flex-shrink-0"
        />
      </Show>

      {/* Tab Bar */}
      <div class="h-10 border-b border-zed-border-subtle flex items-center px-2 gap-1 flex-shrink-0">
        {/* Collapse/Expand Button */}
        <button
          onClick={handleToggleCollapse}
          class="p-1 rounded hover:bg-zed-bg-hover text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
          title={collapsed() ? 'Expand panel' : 'Collapse panel'}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <Show
              when={!collapsed()}
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
        <Show when={!collapsed()}>
          <div class="flex-1 flex items-center gap-1 overflow-x-auto">
            <For each={tabs()}>
              {(tab) => (
                <div
                  class={`group flex items-center gap-2 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                    props.activeTabId === tab.id
                      ? 'bg-zed-bg-active text-zed-text-primary'
                      : 'text-zed-text-secondary hover:bg-zed-bg-hover hover:text-zed-text-primary'
                  }`}
                  onClick={() => props.onTabSelect(tab.id)}
                >
                  <span>{tab.title}</span>
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

      {/* Tab Content - Always mounted, hidden when collapsed */}
      <div
        class="flex-1 overflow-hidden"
        style={{ display: collapsed() ? 'none' : 'block' }}
      >
        <For each={tabs()}>
          {(tab) => (
            <div
              class="h-full"
              style={{ display: props.activeTabId === tab.id ? 'block' : 'none' }}
            >
              <Show when={tab.type === 'terminal'}>
                <TerminalView
                  laneId={`${props.laneId}-tab-${tab.id}`}
                  cwd={props.workingDir}
                  useAgent={false}
                  onAgentFailed={props.onAgentFailed}
                />
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
