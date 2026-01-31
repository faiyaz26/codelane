import { createSignal, onCleanup, createEffect, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface ProcessStats {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsageMb: number;
}

interface ProcessMonitorProps {
  laneId: string | null;
}

export function ProcessMonitor(props: ProcessMonitorProps) {
  const [stats, setStats] = createSignal<ProcessStats | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  let intervalId: number | undefined;

  // Poll for process stats
  createEffect(() => {
    const laneId = props.laneId;

    // Clear previous interval
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }

    if (!laneId) {
      setStats(null);
      setError(null);
      return;
    }

    // Fetch stats immediately
    fetchStatsByLaneId(laneId);

    // Then poll every 2 seconds
    intervalId = setInterval(() => {
      fetchStatsByLaneId(laneId);
    }, 2000) as unknown as number;
  });

  onCleanup(() => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
  });

  const fetchStatsByLaneId = async (laneId: string) => {
    try {
      // First, get the PID from terminal state (more reliable than shell command)
      const pid = await invoke<number | null>('get_terminal_pid_by_lane', { laneId });

      if (!pid) {
        setStats(null);
        return;
      }

      // Then fetch stats for that PID
      const result = await invoke<ProcessStats>('get_process_stats', { pid });
      setStats(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch process stats:', err);
      setError(err instanceof Error ? err.message : String(err));
      setStats(null);
    }
  };

  const formatMemory = (mb: number) => {
    if (mb < 1024) {
      return `${mb.toFixed(0)} MB`;
    }
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getMemoryColor = (mb: number) => {
    if (mb < 500) return 'text-green-400';
    if (mb < 1000) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCpuColor = (cpu: number) => {
    if (cpu < 50) return 'text-green-400';
    if (cpu < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Show when={stats()}>
      {(s) => (
        <div class="flex items-center gap-3 text-xs">
          {/* CPU Usage */}
          <div class="flex items-center gap-1">
            <svg class="w-3 h-3 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <span class={getCpuColor(s().cpuUsage)}>
              {s().cpuUsage.toFixed(1)}%
            </span>
          </div>

          {/* Memory Usage */}
          <div class="flex items-center gap-1">
            <svg class="w-3 h-3 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <span class={getMemoryColor(s().memoryUsageMb)}>
              {formatMemory(s().memoryUsageMb)}
            </span>
          </div>
        </div>
      )}
    </Show>
  );
}
