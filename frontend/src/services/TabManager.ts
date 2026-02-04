/**
 * TabManager - Centralized tab state management
 *
 * Single source of truth for tab state per lane with reactive signals.
 * Handles CRUD operations and persistence to SQLite.
 */

import { createSignal, type Accessor } from 'solid-js';
import { v4 as uuidv4 } from 'uuid';
import type { Tab } from '../types/lane';
import { atomicUpdate, loadTabPanelState } from './TabStorage';

/**
 * Tab manager instance - manages tabs for all lanes
 */
class TabManager {
  // State maps: laneId → signal
  private tabs = new Map<string, ReturnType<typeof createSignal<Tab[]>>>();
  private activeTabs = new Map<string, ReturnType<typeof createSignal<string | undefined>>>();

  /**
   * Initialize lane with tabs from storage
   */
  async initializeLane(laneId: string): Promise<void> {
    if (this.tabs.has(laneId)) {
      return;
    }

    // Load from storage
    const state = await loadTabPanelState(laneId);

    // Create signals
    const tabsSignal = createSignal<Tab[]>(state.tabs);
    const activeTabSignal = createSignal<string | undefined>(state.activeTabId);

    this.tabs.set(laneId, tabsSignal);
    this.activeTabs.set(laneId, activeTabSignal);
  }

  /**
   * Dispose lane (cleanup)
   */
  disposeLane(laneId: string): void {
    this.tabs.delete(laneId);
    this.activeTabs.delete(laneId);
  }

  /**
   * Get reactive tabs accessor for a lane
   */
  getTabs(laneId: string): Accessor<Tab[]> {
    const signal = this.tabs.get(laneId);
    if (!signal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }
    return signal[0];
  }

  /**
   * Get reactive active tab accessor for a lane
   */
  getActiveTab(laneId: string): Accessor<string | undefined> {
    const signal = this.activeTabs.get(laneId);
    if (!signal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }
    return signal[0];
  }

  /**
   * Create a new tab
   */
  async createTab(laneId: string, config?: Partial<Tab>): Promise<Tab> {
    const signal = this.tabs.get(laneId);
    const activeSignal = this.activeTabs.get(laneId);

    if (!signal || !activeSignal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }

    const [tabs, setTabs] = signal;
    const [, setActiveTab] = activeSignal;

    // Create new tab
    const newTab: Tab = {
      id: config?.id || uuidv4(),
      type: config?.type || 'terminal',
      title: config?.title || `Terminal ${tabs().length + 1}`,
      sortOrder: config?.sortOrder ?? tabs().length,
      createdAt: config?.createdAt || Date.now(),
    };

    // Update local state first (optimistic update)
    const updatedTabs = [...tabs(), newTab];
    setTabs(updatedTabs);
    setActiveTab(newTab.id);

    // Persist to storage
    try {
      await atomicUpdate(laneId, (state) => ({
        ...state,
        tabs: updatedTabs,
        activeTabId: newTab.id,
      }));
    } catch (error) {
      console.error('[TabManager] Failed to persist tab creation:', error);
      // Rollback optimistic update
      setTabs(tabs());
      throw error;
    }

    return newTab;
  }

  /**
   * Close a tab
   */
  async closeTab(laneId: string, tabId: string): Promise<void> {
    const signal = this.tabs.get(laneId);
    const activeSignal = this.activeTabs.get(laneId);

    if (!signal || !activeSignal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }

    const [tabs, setTabs] = signal;
    const [activeTab, setActiveTab] = activeSignal;

    const currentTabs = tabs();
    const tabIndex = currentTabs.findIndex((t) => t.id === tabId);

    if (tabIndex === -1) {
      return;
    }

    // Remove tab
    const updatedTabs = currentTabs.filter((t) => t.id !== tabId);

    // Determine new active tab
    let newActiveTab: string | undefined;
    if (activeTab() === tabId) {
      // If closing active tab, switch to adjacent tab
      if (updatedTabs.length > 0) {
        const newIndex = Math.min(tabIndex, updatedTabs.length - 1);
        newActiveTab = updatedTabs[newIndex].id;
      } else {
        newActiveTab = undefined;
      }
    } else {
      newActiveTab = activeTab();
    }

    // Update local state (optimistic)
    setTabs(updatedTabs);
    setActiveTab(newActiveTab);

    // Persist to storage
    try {
      await atomicUpdate(laneId, (state) => ({
        ...state,
        tabs: updatedTabs,
        activeTabId: newActiveTab,
      }));
    } catch (error) {
      console.error('[TabManager] Failed to persist tab closure:', error);
      // Rollback
      setTabs(currentTabs);
      setActiveTab(activeTab());
      throw error;
    }
  }

  /**
   * Select/activate a tab
   */
  async setActiveTab(laneId: string, tabId: string): Promise<void> {
    const signal = this.tabs.get(laneId);
    const activeSignal = this.activeTabs.get(laneId);

    if (!signal || !activeSignal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }

    const [tabs] = signal;
    const [activeTab, setActiveTab] = activeSignal;

    // Verify tab exists
    if (!tabs().find((t) => t.id === tabId)) {
      return;
    }

    // Update local state
    const prevActiveTab = activeTab();
    setActiveTab(tabId);

    // Persist to storage
    try {
      await atomicUpdate(laneId, (state) => ({
        ...state,
        activeTabId: tabId,
      }));
    } catch (error) {
      console.error('[TabManager] Failed to persist active tab:', error);
      // Rollback
      setActiveTab(prevActiveTab);
      throw error;
    }
  }

  /**
   * Rename a tab
   */
  async renameTab(laneId: string, tabId: string, title: string): Promise<void> {
    const signal = this.tabs.get(laneId);

    if (!signal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }

    const [tabs, setTabs] = signal;

    const currentTabs = tabs();
    const tabIndex = currentTabs.findIndex((t) => t.id === tabId);

    if (tabIndex === -1) {
      return;
    }

    // Update tab
    const updatedTabs = [...currentTabs];
    updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], title };

    // Update local state
    setTabs(updatedTabs);

    // Persist to storage
    try {
      await atomicUpdate(laneId, (state) => ({
        ...state,
        tabs: updatedTabs,
      }));
    } catch (error) {
      console.error('[TabManager] Failed to persist tab rename:', error);
      // Rollback
      setTabs(currentTabs);
      throw error;
    }
  }

  /**
   * Reorder tabs
   */
  async reorderTabs(laneId: string, tabIds: string[]): Promise<void> {
    const signal = this.tabs.get(laneId);

    if (!signal) {
      throw new Error(`[TabManager] Lane not initialized: ${laneId}`);
    }

    const [tabs, setTabs] = signal;

    const currentTabs = tabs();

    // Create new tab array with updated sortOrder
    const tabMap = new Map(currentTabs.map((t) => [t.id, t]));
    const updatedTabs = tabIds
      .map((id, index) => {
        const tab = tabMap.get(id);
        if (!tab) return null;
        return { ...tab, sortOrder: index };
      })
      .filter((t): t is Tab => t !== null);

    // Update local state
    setTabs(updatedTabs);

    // Persist to storage
    try {
      await atomicUpdate(laneId, (state) => ({
        ...state,
        tabs: updatedTabs,
      }));
    } catch (error) {
      console.error('[TabManager] Failed to persist tab reorder:', error);
      // Rollback
      setTabs(currentTabs);
      throw error;
    }
  }
}

// Export singleton instance
export const tabManager = new TabManager();
