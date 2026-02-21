/**
 * Storage utilities for persisting app state via Tauri Store
 */

import { getStore } from './store';

const ACTIVE_LANE_KEY = 'active_lane_id';
const PANEL_STATE_PREFIX = 'panel_state:';

/**
 * Gets the active lane ID from store
 */
export async function getActiveLaneId(): Promise<string | null> {
  try {
    const store = await getStore();
    return (await store.get<string>(ACTIVE_LANE_KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * Sets the active lane ID in store
 */
export async function setActiveLaneId(laneId: string | null): Promise<void> {
  try {
    const store = await getStore();
    if (laneId === null) {
      await store.delete(ACTIVE_LANE_KEY);
    } else {
      await store.set(ACTIVE_LANE_KEY, laneId);
    }
    await store.save();
  } catch (err) {
    console.error('Failed to save active lane ID:', err);
  }
}

/**
 * Panel state per lane
 */
export interface PanelState {
  collapsed: boolean;
  height: number;
}

/**
 * Gets panel state for a specific lane
 */
export async function getPanelState(laneId: string): Promise<PanelState> {
  try {
    const store = await getStore();
    const state = await store.get<PanelState>(`${PANEL_STATE_PREFIX}${laneId}`);
    if (state) {
      return state;
    }
  } catch (err) {
    console.error('Failed to load panel state:', err);
  }
  // Default state - collapsed by default
  return { collapsed: true, height: 400 };
}

/**
 * Sets panel state for a specific lane
 */
export async function setPanelState(laneId: string, state: PanelState): Promise<void> {
  try {
    const store = await getStore();
    await store.set(`${PANEL_STATE_PREFIX}${laneId}`, state);
    await store.save();
  } catch (err) {
    console.error('Failed to save panel state:', err);
  }
}
