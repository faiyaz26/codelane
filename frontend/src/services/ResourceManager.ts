/**
 * ResourceManager - Centralized system resource monitoring
 *
 * Provides a single source of truth for CPU/memory usage across the app.
 * - Single polling interval (5s) instead of multiple components polling independently
 * - Exposes reactive signals for components to subscribe
 * - Provides adaptive throttling via isHighLoad() signal
 */

import { createSignal, createRoot, type Accessor, batch } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

export interface AppResourceUsage {
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
}

export interface ProcessStats {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsageMb: number;
}

// Thresholds for adaptive throttling
const HIGH_CPU_THRESHOLD = 70; // Consider high load above 70%
const POLL_INTERVAL_NORMAL = 5000; // 5 seconds
const POLL_INTERVAL_HIGH_LOAD = 10000; // 10 seconds when under load

// Create reactive state within a root to ensure proper SolidJS reactivity
const state = createRoot(() => {
  const [appResources, setAppResources] = createSignal<AppResourceUsage | null>(null);
  const [processStats, setProcessStats] = createSignal<Map<string, ProcessStats>>(new Map());
  const [isHighLoad, setIsHighLoad] = createSignal(false);
  const [isPolling, setIsPolling] = createSignal(false);

  return {
    appResources,
    setAppResources,
    processStats,
    setProcessStats,
    isHighLoad,
    setIsHighLoad,
    isPolling,
    setIsPolling,
  };
});

let pollIntervalId: number | undefined;
let currentLaneId: string | null = null;

async function fetchAppResources(): Promise<void> {
  try {
    const usage = await invoke<AppResourceUsage>('get_app_resource_usage');

    batch(() => {
      state.setAppResources(usage);
      // Update high load status based on CPU
      state.setIsHighLoad(usage.cpuPercent > HIGH_CPU_THRESHOLD);
    });
  } catch (err) {
    // Silently fail - resource monitoring is non-critical
  }
}

async function fetchProcessStats(laneId: string): Promise<void> {
  try {
    const pid = await invoke<number | null>('get_terminal_pid_by_lane', { laneId });

    if (!pid) {
      // Remove stats for this lane if no PID
      const current = new Map(state.processStats());
      if (current.has(laneId)) {
        current.delete(laneId);
        state.setProcessStats(current);
      }
      return;
    }

    const stats = await invoke<ProcessStats>('get_process_stats', { pid });

    const current = new Map(state.processStats());
    current.set(laneId, stats);
    state.setProcessStats(current);
  } catch (err) {
    // Remove stats on error
    const current = new Map(state.processStats());
    if (current.has(laneId)) {
      current.delete(laneId);
      state.setProcessStats(current);
    }
  }
}

async function poll(): Promise<void> {
  await fetchAppResources();

  // Also fetch process stats for active lane if set
  if (currentLaneId) {
    await fetchProcessStats(currentLaneId);
  }
}

function startPolling(): void {
  if (state.isPolling()) return;

  state.setIsPolling(true);

  // Initial fetch
  poll();

  // Start interval with adaptive timing
  const scheduleNext = () => {
    const interval = state.isHighLoad() ? POLL_INTERVAL_HIGH_LOAD : POLL_INTERVAL_NORMAL;
    pollIntervalId = window.setTimeout(async () => {
      await poll();
      if (state.isPolling()) {
        scheduleNext();
      }
    }, interval);
  };

  scheduleNext();
}

function stopPolling(): void {
  state.setIsPolling(false);

  if (pollIntervalId !== undefined) {
    clearTimeout(pollIntervalId);
    pollIntervalId = undefined;
  }
}

// Export the resource manager API
export const resourceManager = {
  /**
   * Start monitoring resources. Call once when app initializes.
   */
  start(): void {
    startPolling();
  },

  /**
   * Stop monitoring resources. Call when app closes.
   */
  stop(): void {
    stopPolling();
  },

  /**
   * Get app-level resource usage (CPU/memory for Codelane process)
   */
  getAppResources(): Accessor<AppResourceUsage | null> {
    return state.appResources;
  },

  /**
   * Get process stats for a specific lane's terminal process
   */
  getProcessStats(laneId: string): Accessor<ProcessStats | undefined> {
    return () => state.processStats().get(laneId);
  },

  /**
   * Check if system is under high load (for adaptive throttling)
   * Components can use this to reduce their update frequency
   */
  isHighLoad(): Accessor<boolean> {
    return state.isHighLoad;
  },

  /**
   * Set the active lane for process monitoring.
   * Only the active lane's process stats are tracked to reduce overhead.
   */
  setActiveLane(laneId: string | null): void {
    currentLaneId = laneId;

    // Immediately fetch stats for new lane
    if (laneId && state.isPolling()) {
      fetchProcessStats(laneId);
    }
  },

  /**
   * Force an immediate refresh (useful after significant state changes)
   */
  async refresh(): Promise<void> {
    await poll();
  },

  /**
   * Get recommended debounce time based on system load
   */
  getRecommendedDebounce(baseMs: number): number {
    return state.isHighLoad() ? baseMs * 2 : baseMs;
  },
};
