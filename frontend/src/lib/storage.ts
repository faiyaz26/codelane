/**
 * Local storage utilities for persisting app state
 */

const ACTIVE_LANE_KEY = 'codelane_active_lane_id';
const PANEL_STATE_KEY = 'codelane_panel_state';

/**
 * Gets the active lane ID from localStorage
 */
export function getActiveLaneId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_LANE_KEY);
  } catch {
    return null;
  }
}

/**
 * Sets the active lane ID in localStorage
 */
export function setActiveLaneId(laneId: string | null): void {
  try {
    if (laneId === null) {
      localStorage.removeItem(ACTIVE_LANE_KEY);
    } else {
      localStorage.setItem(ACTIVE_LANE_KEY, laneId);
    }
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
export function getPanelState(laneId: string): PanelState {
  try {
    const stored = localStorage.getItem(`${PANEL_STATE_KEY}_${laneId}`);
    if (stored) {
      return JSON.parse(stored);
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
export function setPanelState(laneId: string, state: PanelState): void {
  try {
    localStorage.setItem(`${PANEL_STATE_KEY}_${laneId}`, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save panel state:', err);
  }
}
