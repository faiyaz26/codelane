import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileWatchEvent } from '../FileWatchService';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

let fileWatchService: typeof import('../FileWatchService')['fileWatchService'];
let capturedEventHandler: ((event: { payload: FileWatchEvent }) => void) | null = null;

beforeEach(async () => {
  mockInvoke.mockReset();
  mockListen.mockReset();
  capturedEventHandler = null;

  // Mock listen to capture the event handler
  mockListen.mockImplementation(async (eventName: string, handler: (event: { payload: FileWatchEvent }) => void) => {
    capturedEventHandler = handler;
    return () => {
      capturedEventHandler = null;
    };
  });

  vi.resetModules();
  const mod = await import('../FileWatchService');
  fileWatchService = mod.fileWatchService;
});

function simulateFileEvent(event: FileWatchEvent): void {
  if (capturedEventHandler) {
    capturedEventHandler({ payload: event });
  }
}

describe('FileWatchService', () => {
  describe('watchDirectory', () => {
    it('calls invoke to start watching', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');

      await fileWatchService.watchDirectory('/path/to/dir', vi.fn());

      expect(mockInvoke).toHaveBeenCalledWith('watch_path', {
        path: '/path/to/dir',
        recursive: true,
      });
    });

    it('passes recursive=false for watchFile', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');

      await fileWatchService.watchFile('/path/to/file.ts', vi.fn());

      expect(mockInvoke).toHaveBeenCalledWith('watch_path', {
        path: '/path/to/file.ts',
        recursive: false,
      });
    });

    it('dispatches events to registered callbacks', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');
      const callback = vi.fn();

      await fileWatchService.watchDirectory('/path/to/dir', callback);

      simulateFileEvent({
        watch_id: 'watch-id-1',
        path: '/path/to/dir/file.ts',
        kind: 'modify',
      });

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith({
        watch_id: 'watch-id-1',
        path: '/path/to/dir/file.ts',
        kind: 'modify',
      });
    });

    it('supports multiple callbacks for same path', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      await fileWatchService.watchDirectory('/path/to/dir', callback1);
      await fileWatchService.watchDirectory('/path/to/dir', callback2);

      simulateFileEvent({
        watch_id: 'watch-id-1',
        path: '/path/to/dir/file.ts',
        kind: 'create',
      });

      expect(callback1).toHaveBeenCalledOnce();
      expect(callback2).toHaveBeenCalledOnce();
    });

    it('does not call invoke twice for same path', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');

      await fileWatchService.watchDirectory('/path/to/dir', vi.fn());
      await fileWatchService.watchDirectory('/path/to/dir', vi.fn());

      // watch_path should only be called once
      const watchCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === 'watch_path',
      );
      expect(watchCalls).toHaveLength(1);
    });

    it('does not dispatch events for unknown watch ids', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');
      const callback = vi.fn();

      await fileWatchService.watchDirectory('/path/to/dir', callback);

      simulateFileEvent({
        watch_id: 'unknown-id',
        path: '/other/path',
        kind: 'modify',
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('removes callback from watch entry', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');
      const callback = vi.fn();

      const unsub = await fileWatchService.watchDirectory('/path/to/dir', callback);
      unsub();

      simulateFileEvent({
        watch_id: 'watch-id-1',
        path: '/path/to/dir/file.ts',
        kind: 'modify',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('calls unwatch_path when last callback is removed', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');

      const unsub = await fileWatchService.watchDirectory('/path/to/dir', vi.fn());
      unsub();

      expect(mockInvoke).toHaveBeenCalledWith('unwatch_path', { watchId: 'watch-id-1' });
    });

    it('does not call unwatch_path when other callbacks remain', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');

      const unsub1 = await fileWatchService.watchDirectory('/path/to/dir', vi.fn());
      await fileWatchService.watchDirectory('/path/to/dir', vi.fn());

      unsub1();

      const unwatchCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === 'unwatch_path',
      );
      expect(unwatchCalls).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('cleans up all watches', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'watch_path') {
          return `watch-id-${++callCount}`;
        }
      });

      await fileWatchService.watchDirectory('/path/one', vi.fn());
      await fileWatchService.watchDirectory('/path/two', vi.fn());

      fileWatchService.dispose();

      // Should have called unwatch_path for both
      const unwatchCalls = mockInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'unwatch_path',
      );
      expect(unwatchCalls).toHaveLength(2);
    });
  });

  describe('error handling in callbacks', () => {
    it('does not break other callbacks when one throws', async () => {
      mockInvoke.mockResolvedValue('watch-id-1');
      const throwingCallback = vi.fn(() => {
        throw new Error('callback error');
      });
      const normalCallback = vi.fn();

      await fileWatchService.watchDirectory('/path/to/dir', throwingCallback);
      await fileWatchService.watchDirectory('/path/to/dir', normalCallback);

      simulateFileEvent({
        watch_id: 'watch-id-1',
        path: '/path/to/dir/file.ts',
        kind: 'modify',
      });

      expect(throwingCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });
});
