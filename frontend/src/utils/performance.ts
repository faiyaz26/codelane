/**
 * Performance monitoring utilities for Codelane frontend
 *
 * Usage:
 *   - Add <PerformanceMonitor /> to App.tsx for continuous monitoring
 *   - Use measureRender() around expensive computations
 *   - Use measureAsync() for async operations
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'render' | 'async' | 'interaction';
  metadata?: Record<string, any>;
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private observers: ((metric: PerformanceMetric) => void)[] = [];
  private readonly maxMetrics = 1000;

  constructor() {
    // Monitor long tasks (>50ms)
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`⚠️ Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
              this.addMetric({
                name: entry.name,
                duration: entry.duration,
                timestamp: entry.startTime,
                type: 'interaction',
                metadata: { entryType: entry.entryType }
              });
            }
          }
        });
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (e) {
        console.warn('PerformanceObserver not supported', e);
      }
    }
  }

  addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
    this.observers.forEach(observer => observer(metric));
  }

  subscribe(callback: (metric: PerformanceMetric) => void) {
    this.observers.push(callback);
    return () => {
      this.observers = this.observers.filter(obs => obs !== callback);
    };
  }

  getMetrics(filter?: { type?: string; since?: number }) {
    let filtered = this.metrics;

    if (filter?.type) {
      filtered = filtered.filter(m => m.type === filter.type);
    }

    if (filter?.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since);
    }

    return filtered;
  }

  getStats() {
    const byType = this.metrics.reduce((acc, m) => {
      if (!acc[m.type]) {
        acc[m.type] = { count: 0, totalDuration: 0, avg: 0, max: 0 };
      }
      acc[m.type].count++;
      acc[m.type].totalDuration += m.duration;
      acc[m.type].max = Math.max(acc[m.type].max, m.duration);
      return acc;
    }, {} as Record<string, { count: number; totalDuration: number; avg: number; max: number }>);

    Object.keys(byType).forEach(type => {
      byType[type].avg = byType[type].totalDuration / byType[type].count;
    });

    return byType;
  }

  clear() {
    this.metrics = [];
  }

  exportMetrics() {
    return {
      metrics: this.metrics,
      stats: this.getStats(),
      timestamp: Date.now()
    };
  }
}

export const perfTracker = new PerformanceTracker();

/**
 * Measure render performance of a function
 */
export function measureRender<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    perfTracker.addMetric({
      name,
      duration,
      timestamp: start,
      type: 'render',
      metadata
    });

    if (duration > 16.67) { // Slower than 60fps
      console.warn(`🐌 Slow render: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Measure async operation performance
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    perfTracker.addMetric({
      name,
      duration,
      timestamp: start,
      type: 'async',
      metadata
    });

    if (duration > 100) {
      console.warn(`⏱️ Slow async: ${name} took ${duration.toFixed(2)}ms`);
    }
  }
}

/**
 * Create a performance mark
 */
export function mark(name: string) {
  performance.mark(name);
}

/**
 * Measure between two marks
 */
export function measureBetween(name: string, startMark: string, endMark: string) {
  performance.measure(name, startMark, endMark);
  const measure = performance.getEntriesByName(name, 'measure')[0];
  if (measure) {
    perfTracker.addMetric({
      name,
      duration: measure.duration,
      timestamp: measure.startTime,
      type: 'interaction'
    });
  }
}

/**
 * Get Web Vitals metrics
 */
export function getWebVitals() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (!navigation) {
    return null;
  }

  return {
    // Time to First Byte
    ttfb: navigation.responseStart - navigation.requestStart,

    // DOM Content Loaded
    dcl: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,

    // Load Complete
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,

    // DOM Interactive
    domInteractive: navigation.domInteractive - navigation.fetchStart,

    // Total page load
    totalLoad: navigation.loadEventEnd - navigation.fetchStart,
  };
}

/**
 * Monitor memory usage (if available)
 */
export function getMemoryUsage() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedPercentage: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)
    };
  }
  return null;
}

/**
 * Print performance report to console
 */
export function printPerformanceReport() {
  console.group('📊 Codelane Performance Report');

  const stats = perfTracker.getStats();
  console.table(stats);

  const vitals = getWebVitals();
  if (vitals) {
    console.group('🌐 Web Vitals');
    console.table(vitals);
    console.groupEnd();
  }

  const memory = getMemoryUsage();
  if (memory) {
    console.group('💾 Memory Usage');
    console.table(memory);
    console.groupEnd();
  }

  const slowOperations = perfTracker.getMetrics()
    .filter(m => m.duration > 50)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  if (slowOperations.length > 0) {
    console.group('🐌 Top 10 Slowest Operations');
    console.table(slowOperations.map(m => ({
      name: m.name,
      type: m.type,
      duration: m.duration.toFixed(2) + 'ms'
    })));
    console.groupEnd();
  }

  console.groupEnd();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).codelanePerf = {
    tracker: perfTracker,
    report: printPerformanceReport,
    getWebVitals,
    getMemoryUsage,
  };
}
