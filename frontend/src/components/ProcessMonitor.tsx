import { createEffect, Show } from 'solid-js';
import { resourceManager, type ProcessStats } from '../services/ResourceManager';

interface ProcessMonitorProps {
  laneId: string | null;
}

export function ProcessMonitor(props: ProcessMonitorProps) {
  // Update resource manager's active lane when laneId changes
  createEffect(() => {
    resourceManager.setActiveLane(props.laneId);
  });

  // Get stats from centralized resource manager
  const stats = () => {
    if (!props.laneId) return null;
    return resourceManager.getProcessStats(props.laneId)();
  };

  const formatMemory = (s: ProcessStats) => {
    // If RSS is very low (< 5MB) but virtual memory is high, 
    // it's likely sysinfo is missing some mappings.
    // For TUI/CLI tools like Gemini, 1MB is almost certainly wrong.
    let mb = s.memoryUsageMb;
    if (mb < 5 && s.virtualMemory > 0) {
      // Use a small fraction of virtual memory as a fallback heuristic for "real" usage
      // or just show virtual memory if it seems more plausible.
      const vm_mb = s.virtualMemory / 1024 / 1024;
      if (vm_mb > 10) mb = Math.min(vm_mb, 250); // Cap heuristic for stability
    }

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
        <div 
          class="flex items-center gap-3 text-xs" 
          title={`PID: ${s().pid}\nChildren: ${s().childrenCount}\nRSS: ${s().memoryUsageMb.toFixed(1)} MB\nVirtual: ${(s().virtualMemory / 1024 / 1024).toFixed(0)} MB`}
        >
          {/* Children Count */}
          <Show when={s().childrenCount > 0}>
            <div class="flex items-center gap-1 text-zed-text-tertiary" title={`${s().childrenCount} child processes`}>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{s().childrenCount + 1}</span>
            </div>
          </Show>

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
              {formatMemory(s())}
            </span>
          </div>
        </div>
      )}
    </Show>
  );
}
