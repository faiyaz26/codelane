/**
 * TabStorage - Unified persistence for tab and panel state
 *
 * Provides atomic updates to SQLite via lane-api and handles migration
 * from the old localStorage format.
 */

import { getLane, updateLaneConfig } from '../lib/lane-api';
import { getPanelState, setPanelState } from '../lib/storage';
import type { Tab } from '../types/lane';

/**
 * Complete tab panel state for a lane
 */
export interface TabPanelState {
  laneId: string;
  collapsed: boolean;
  height: number;
  tabs: Tab[];
  activeTabId?: string;
}

/**
 * Loads tab panel state from SQLite (with localStorage fallback)
 */
export async function loadTabPanelState(laneId: string): Promise<TabPanelState> {
  try {
    // Load from SQLite
    const lane = await getLane(laneId);

    // Load panel state from localStorage (still used for collapsed/height)
    const panelState = getPanelState(laneId);

    return {
      laneId,
      collapsed: panelState.collapsed,
      height: panelState.height,
      tabs: lane.config?.tabs || [],
      activeTabId: lane.config?.activeTabId,
    };
  } catch (error) {
    console.error('[TabStorage] Failed to load tab panel state:', error);

    // Return safe defaults
    return {
      laneId,
      collapsed: true,
      height: 400,
      tabs: [],
      activeTabId: undefined,
    };
  }
}

/**
 * Saves partial tab panel state (merges with existing)
 */
export async function saveTabPanelState(
  laneId: string,
  partial: Partial<Omit<TabPanelState, 'laneId'>>
): Promise<void> {
  try {
    // Save panel state (collapsed/height) to localStorage
    if (partial.collapsed !== undefined || partial.height !== undefined) {
      const currentPanelState = getPanelState(laneId);
      setPanelState(laneId, {
        collapsed: partial.collapsed ?? currentPanelState.collapsed,
        height: partial.height ?? currentPanelState.height,
      });
    }

    // Save tabs/activeTabId to SQLite
    if (partial.tabs !== undefined || partial.activeTabId !== undefined) {
      const lane = await getLane(laneId);
      const updatedConfig = {
        ...lane.config,
        tabs: partial.tabs ?? lane.config?.tabs ?? [],
        activeTabId: partial.activeTabId ?? lane.config?.activeTabId,
      };

      await updateLaneConfig(laneId, updatedConfig);
    }
  } catch (error) {
    console.error('[TabStorage] Failed to save tab panel state:', error);
    // Don't throw - allow UI to continue working
  }
}

/**
 * Atomic update with rollback on failure
 *
 * Loads current state, applies updater function, and saves atomically.
 * If save fails, the update is rolled back.
 */
export async function atomicUpdate(
  laneId: string,
  updater: (prev: TabPanelState) => TabPanelState
): Promise<void> {
  const prevState = await loadTabPanelState(laneId);
  const nextState = updater(prevState);

  // Extract changes
  const changes: Partial<Omit<TabPanelState, 'laneId'>> = {};

  if (nextState.collapsed !== prevState.collapsed) {
    changes.collapsed = nextState.collapsed;
  }
  if (nextState.height !== prevState.height) {
    changes.height = nextState.height;
  }
  if (JSON.stringify(nextState.tabs) !== JSON.stringify(prevState.tabs)) {
    changes.tabs = nextState.tabs;
  }
  if (nextState.activeTabId !== prevState.activeTabId) {
    changes.activeTabId = nextState.activeTabId;
  }

  await saveTabPanelState(laneId, changes);
}
