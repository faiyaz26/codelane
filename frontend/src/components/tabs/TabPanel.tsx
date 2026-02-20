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
}

export function TabPanel(props: TabPanelProps) {
  const tabManager = useTabManager();

  // Panel UI state
  const initialState = getPanelState(props.laneId);
  const [collapsed, setCollapsed] = createSignal(initialState.collapsed);
  const [height, setHeight] = createSignal(initialState.height);
  const [isResizing, setIsResizing] = createSignal(false);

  const minHeight = 40;
  const maxHeight = () => window.innerHeight * 0.5; // 50% of viewport height
  const panelHeight = () => (collapsed() ? minHeight : Math.min(height(), maxHeight()));

  // Get reactive tabs and activeTabId from TabManager
  const tabs = tabManager.getTabs(props.laneId);
  const activeTabId = tabManager.getActiveTab(props.laneId);

  // Save panel state to localStorage when it changes
  createEffect(() => {
    setPanelState(props.laneId, {
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
        height: `${panelHeight()}px`,
        transition: isResizing() ? 'none' : 'height 0.2s',
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
      <TabBar
        tabs={tabs()}
        activeTabId={activeTabId()}
        collapsed={collapsed()}
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
          ...(collapsed() ? {
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
