import { createSignal, onCleanup, Show } from 'solid-js';
import { perfTracker, getMemoryUsage, getWebVitals } from '../../utils/performance';

/**
 * Performance monitoring overlay for development
 * Shows real-time performance metrics
 *
 * Usage: Add <PerformanceMonitor /> to App.tsx in dev mode
 */
export function PerformanceMonitor() {
  const [isVisible, setIsVisible] = createSignal(false);
  const [fps, setFps] = createSignal(60);
  const [metrics, setMetrics] = createSignal(perfTracker.getStats());
  const [memory, setMemory] = createSignal(getMemoryUsage());

  // FPS counter
  let frameCount = 0;
  let lastTime = performance.now();

  const measureFps = () => {
    frameCount++;
    const currentTime = performance.now();

    if (currentTime >= lastTime + 1000) {
      setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
      frameCount = 0;
      lastTime = currentTime;
    }

    requestAnimationFrame(measureFps);
  };

  requestAnimationFrame(measureFps);

  // Update metrics periodically
  const interval = setInterval(() => {
    setMetrics(perfTracker.getStats());
    setMemory(getMemoryUsage());
  }, 1000);

  onCleanup(() => clearInterval(interval));

  // Keyboard shortcut: Ctrl+Shift+P to toggle
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      setIsVisible(!isVisible());
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  onCleanup(() => document.removeEventListener('keydown', handleKeyDown));

  return (
    <Show when={isVisible()}>
      <div class="fixed bottom-4 right-4 bg-codelane-800 border border-codelane-600 rounded-lg shadow-2xl p-4 text-xs font-mono z-[9999] max-w-md">
        <div class="flex justify-between items-center mb-3 border-b border-codelane-600 pb-2">
          <h3 class="text-codelane-100 font-semibold">⚡ Performance Monitor</h3>
          <button
            onClick={() => setIsVisible(false)}
            class="text-codelane-400 hover:text-codelane-200 px-2"
          >
            ×
          </button>
        </div>

        {/* FPS */}
        <div class="mb-3">
          <div class="flex justify-between text-codelane-300 mb-1">
            <span>FPS</span>
            <span class={fps() >= 55 ? 'text-green-400' : fps() >= 30 ? 'text-yellow-400' : 'text-red-400'}>
              {fps()}
            </span>
          </div>
          <div class="w-full bg-codelane-700 rounded-full h-2">
            <div
              class={`h-2 rounded-full transition-all ${
                fps() >= 55 ? 'bg-green-500' : fps() >= 30 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${(fps() / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <Show when={memory()}>
          {(mem) => (
            <div class="mb-3">
              <div class="flex justify-between text-codelane-300 mb-1">
                <span>Memory</span>
                <span>{mem().usedPercentage}%</span>
              </div>
              <div class="text-codelane-400 text-[10px]">
                {(mem().usedJSHeapSize / 1024 / 1024).toFixed(1)} MB / {(mem().jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB
              </div>
            </div>
          )}
        </Show>

        {/* Metrics */}
        <div class="space-y-2">
          <Show when={Object.keys(metrics()).length > 0}>
            <div class="text-codelane-300 font-semibold mb-1">Operations:</div>
            {Object.entries(metrics()).map(([type, stats]) => (
              <div class="flex justify-between text-codelane-400">
                <span class="capitalize">{type}</span>
                <span>
                  {stats.count} ops • avg {stats.avg.toFixed(1)}ms • max {stats.max.toFixed(1)}ms
                </span>
              </div>
            ))}
          </Show>
        </div>

        <div class="mt-3 pt-3 border-t border-codelane-600 text-[10px] text-codelane-500">
          Press Ctrl+Shift+P to toggle • <button
            onClick={() => {
              console.clear();
              (window as any).codelanePerf.report();
            }}
            class="text-codelane-400 hover:text-codelane-200 underline"
          >
            Print Report
          </button>
        </div>
      </div>
    </Show>
  );
}
