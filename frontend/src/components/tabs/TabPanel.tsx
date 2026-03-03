/**
 * TabPanel - Main orchestrator for tab system
 *
 * Manages panel state (collapsed, height), coordinates TabBar and TabContent,
 * delegates to TabManager for state operations.
 */

import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { useTabManager } from '../../hooks/useTabManager';
import { getPanelState, setPanelState } from '../../lib/storage';
import { TabBar } from './TabBar';
import { TabContent } from './TabContent';

interface TabPanelProps {
  laneId: string;
  workingDir: string;
  isExtensionTabActive?: boolean;
}

export function TabPanel(props: TabPanelProps) {
  const tabManager = useTabManager();

  // Panel UI state (defaults, updated async)
  const [collapsed, setCollapsed] = createSignal(true);
  const [height, setHeight] = createSignal(400);
  const [isResizing, setIsResizing] = createSignal(false);

  // Load initial panel state from store
  onMount(async () => {
    const initialState = await getPanelState(props.laneId);
    setCollapsed(initialState.collapsed);
    setHeight(initialState.height);
  });

  const minHeight = 40;
  const maxHeight = () => window.innerHeight * 0.5; // 50% of viewport height
  const panelHeight = () => {
    if (props.isExtensionTabActive) return '100%';
    return (collapsed() ? minHeight : Math.min(height(), maxHeight()));
  };

  // Get reactive tabs and activeTabId from TabManager
  const tabs = tabManager.getTabs(props.laneId);
  const activeTabId = tabManager.getActiveTab(props.laneId);

  // Save panel state to store when it changes
  createEffect(() => {
    void setPanelState(props.laneId, {
      collapsed: collapsed(),
      height: height(),
    });
  });

  // Create tab if none exist when expanding
  createEffect((prev) => {
    const isCollapsed = collapsed();
    // If we just expanded (was collapsed, now not)
    if (prev === true && isCollapsed === false) {
      // If there are no tabs, create one
      if (tabs().length === 0) {
        tabManager.createTab(props.laneId).catch((err) => {
          console.error('[TabPanel] Failed to create tab on expand:', err);
        });
      }
      // Trigger terminal refit after expanding (terminals may need dimension recalculation)
      setTimeout(() => window.dispatchEvent(new Event('terminal-resize')), 100);
    }
    return isCollapsed;
  });

  // Auto-collapse when all tabs are closed
  createEffect((prev) => {
    const tabCount = tabs().length;
    const currentCollapsed = collapsed();

    // Only auto-collapse if we had tabs before and now we don't
    if (tabCount === 0 && !currentCollapsed && prev && prev.tabCount > 0) {
      setCollapsed(true);
    }

    return { tabCount };
  });

  // Resize handling
  const handleMouseDown = (e: MouseEvent) => {
    if (collapsed()) return;
    setIsResizing(true);
    e.preventDefault();
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

  const handleToggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  // Tab operations (delegate to TabManager)
  const handleTabCreate = async () => {
    try {
      await tabManager.createTab(props.laneId);
    } catch (err) {
      console.error('[TabPanel] Failed to create tab:', err);
    }
  };

  const handleTabClose = async (tabId: string) => {
    try {
      await tabManager.closeTab(props.laneId, tabId);
    } catch (err) {
      console.error('[TabPanel] Failed to close tab:', err);
    }
  };

  const handleTabSelect = async (tabId: string) => {
    try {
      await tabManager.setActiveTab(props.laneId, tabId);
    } catch (err) {
      console.error('[TabPanel] Failed to select tab:', err);
    }
  };

  const handleTabRename = async (tabId: string, newTitle: string) => {
    try {
      await tabManager.renameTab(props.laneId, tabId, newTitle);
    } catch (err) {
      console.error('[TabPanel] Failed to rename tab:', err);
    }
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
        height: typeof panelHeight() === 'number' ? `${panelHeight()}px` : panelHeight(),
        transition: isResizing() || props.isExtensionTabActive ? 'none' : 'height 0.2s',
        flex: props.isExtensionTabActive ? '1' : 'none',
      }}
    >
      {/* Resize Handle */}
      <Show when={!collapsed() && !props.isExtensionTabActive}>
        <div
          onMouseDown={handleMouseDown}
          class="h-1 cursor-ns-resize hover:bg-zed-accent-blue/50 active:bg-zed-accent-blue transition-colors flex-shrink-0"
        />
      </Show>

      {/* Tab Bar */}
      <TabBar
        tabs={tabs()}
        activeTabId={activeTabId()}
        collapsed={collapsed() && !props.isExtensionTabActive}
        onToggleCollapse={handleToggleCollapse}
        onTabCreate={handleTabCreate}
        onTabClose={handleTabClose}
        onTabSelect={handleTabSelect}
        onTabRename={handleTabRename}
      />

      {/* Tab Content - Clipped when collapsed to preserve terminal state */}
      <div
        class="flex-1 overflow-hidden"
        style={{
          // Use clip instead of h-0/visibility:hidden so xterm.js keeps valid dimensions
          // and doesn't corrupt its internal state when collapsed
          ...(collapsed() && !props.isExtensionTabActive ? {
            'clip-path': 'inset(0 0 100% 0)',
            position: 'absolute' as const,
            width: '100%',
            height: '200px',
            'pointer-events': 'none',
          } : {}),
        }}
      >
        <TabContent
          laneId={props.laneId}
          workingDir={props.workingDir}
          tabs={tabs()}
          activeTabId={activeTabId()}
        />
      </div>
    </div>
  );
}
