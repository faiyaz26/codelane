import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

let resourceManager: typeof import('../ResourceManager')['resourceManager'];

beforeEach(async () => {
  vi.useFakeTimers();
  mockInvoke.mockReset();
  vi.resetModules();

  const mod = await import('../ResourceManager');
  resourceManager = mod.resourceManager;
});

afterEach(() => {
  resourceManager.stop();
  vi.useRealTimers();
});

describe('ResourceManager', () => {
  describe('start/stop', () => {
    it('starts polling and fetches resources immediately', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 25, memoryMb: 100, memoryPercent: 30 });

      resourceManager.start();

      // Wait for the initial poll
      await vi.advanceTimersByTimeAsync(0);

      expect(mockInvoke).toHaveBeenCalledWith('get_app_resource_usage');
    });

    it('does not double-start when called twice', () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 10, memoryMb: 50, memoryPercent: 10 });

      resourceManager.start();
      resourceManager.start();

      // Should only fire the initial poll once
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('stop prevents further polling', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 10, memoryMb: 50, memoryPercent: 10 });

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      const callCount = mockInvoke.mock.calls.length;
      resourceManager.stop();

      await vi.advanceTimersByTimeAsync(10000);
      expect(mockInvoke.mock.calls.length).toBe(callCount);
    });
  });

  describe('getAppResources', () => {
    it('returns null before polling starts', () => {
      const resources = resourceManager.getAppResources();
      expect(resources()).toBeNull();
    });

    it('returns resource data after poll', async () => {
      const mockUsage = { cpuPercent: 45, memoryMb: 256, memoryPercent: 50 };
      mockInvoke.mockResolvedValue(mockUsage);

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      const resources = resourceManager.getAppResources();
      expect(resources()).toEqual(mockUsage);
    });
  });

  describe('isHighLoad', () => {
    it('returns false for low CPU usage', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 30, memoryMb: 100, memoryPercent: 20 });

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(resourceManager.isHighLoad()()).toBe(false);
    });

    it('returns true for high CPU usage (>70%)', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 85, memoryMb: 500, memoryPercent: 80 });

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(resourceManager.isHighLoad()()).toBe(true);
    });
  });

  describe('getRecommendedDebounce', () => {
    it('returns base time under normal load', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 30, memoryMb: 100, memoryPercent: 20 });

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(resourceManager.getRecommendedDebounce(100)).toBe(100);
    });

    it('returns doubled time under high load', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 85, memoryMb: 500, memoryPercent: 80 });

      resourceManager.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(resourceManager.getRecommendedDebounce(100)).toBe(200);
    });
  });

  describe('setActiveLane / getProcessStats', () => {
    it('fetches process stats for active lane', async () => {
      mockInvoke
        .mockResolvedValueOnce({ cpuPercent: 10, memoryMb: 50, memoryPercent: 10 }) // app resources
        .mockResolvedValueOnce(1234) // get_terminal_pid_by_lane
        .mockResolvedValueOnce({ pid: 1234, cpuUsage: 5, memoryUsage: 100, memoryUsageMb: 50 }); // get_process_stats

      resourceManager.start();
      resourceManager.setActiveLane('lane-1');

      await vi.advanceTimersByTimeAsync(0);

      // Should have called get_terminal_pid_by_lane
      expect(mockInvoke).toHaveBeenCalledWith('get_terminal_pid_by_lane', { laneId: 'lane-1' });
    });

    it('returns undefined stats for lane without PID', async () => {
      mockInvoke
        .mockResolvedValueOnce({ cpuPercent: 10, memoryMb: 50, memoryPercent: 10 })
        .mockResolvedValueOnce(null); // no PID

      resourceManager.start();
      resourceManager.setActiveLane('lane-1');

      await vi.advanceTimersByTimeAsync(0);

      const stats = resourceManager.getProcessStats('lane-1');
      expect(stats()).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('triggers an immediate poll', async () => {
      mockInvoke.mockResolvedValue({ cpuPercent: 20, memoryMb: 80, memoryPercent: 15 });

      await resourceManager.refresh();

      expect(mockInvoke).toHaveBeenCalledWith('get_app_resource_usage');
    });
  });

  describe('error handling', () => {
    it('handles invoke failure gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Tauri error'));

      resourceManager.start();
      // Should not throw
      await vi.advanceTimersByTimeAsync(0);

      const resources = resourceManager.getAppResources();
      expect(resources()).toBeNull();
    });
  });
});
