/**
 * Local storage utilities for persisting app state
 */

const ACTIVE_LANE_KEY = 'codelane_active_lane_id';

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
