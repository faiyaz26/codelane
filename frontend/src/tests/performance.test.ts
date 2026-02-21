import { describe, it, expect, beforeEach } from 'vitest';
import { perfTracker, measureRender, measureAsync } from '../utils/performance';

describe('Performance Tracking', () => {
  beforeEach(() => {
    perfTracker.clear();
  });

  it('should track render performance', () => {
    const result = measureRender('test-render', () => {
      // Simulate work
      const sum = Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
      return sum;
    });

    expect(result).toBe(499500);

    const metrics = perfTracker.getMetrics({ type: 'render' });
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe('test-render');
    expect(metrics[0].duration).toBeGreaterThan(0);
  });

  it('should track async performance', async () => {
    const result = await measureAsync('test-async', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 42;
    });

    expect(result).toBe(42);

    const metrics = perfTracker.getMetrics({ type: 'async' });
    expect(metrics.length).toBe(1);
    expect(metrics[0].name).toBe('test-async');
    expect(metrics[0].duration).toBeGreaterThanOrEqual(8); // Allow tolerance for coverage overhead
  });

  it('should calculate stats correctly', () => {
    measureRender('op1', () => {});
    measureRender('op2', () => {});
    measureAsync('async-op', async () => {});

    const stats = perfTracker.getStats();
    expect(stats.render.count).toBe(2);
  });

  it('should limit metrics storage', () => {
    // Add more than max metrics
    for (let i = 0; i < 1100; i++) {
      measureRender(`op-${i}`, () => {});
    }

    const metrics = perfTracker.getMetrics();
    expect(metrics.length).toBeLessThanOrEqual(1000);
  });

  it('should support metric filtering', async () => {
    // Use performance.now() since that's what metrics use for timestamps
    const timestamp = performance.now();
    measureRender('render-op', () => {});
    await measureAsync('async-op', async () => {});

    const renderMetrics = perfTracker.getMetrics({ type: 'render' });
    expect(renderMetrics.length).toBe(1);

    const recentMetrics = perfTracker.getMetrics({ since: timestamp });
    expect(recentMetrics.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Performance Benchmarks', () => {
  it('render should be faster than 16ms (60fps)', () => {
    const duration = measureRender('60fps-test', () => {
      // Light work
      return Array.from({ length: 100 }, (_, i) => i * 2);
    });

    const metrics = perfTracker.getMetrics({ type: 'render' });
    expect(metrics[0].duration).toBeLessThan(16.67);
  });

  it('should warn on slow renders', () => {
    const consoleSpy = vi.spyOn(console, 'warn');

    measureRender('slow-render', () => {
      // Intentionally slow operation
      let sum = 0;
      for (let i = 0; i < 10_000_000; i++) {
        sum += i;
      }
      return sum;
    });

    // Should have warned about slow render
    const metrics = perfTracker.getMetrics();
    if (metrics[0].duration > 16.67) {
      expect(consoleSpy).toHaveBeenCalled();
    }

    consoleSpy.mockRestore();
  });
});
