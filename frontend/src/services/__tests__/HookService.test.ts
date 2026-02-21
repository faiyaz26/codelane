import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HookEvent, HookStatus } from '../../types/hooks';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

let hookService: typeof import('../HookService')['hookService'];

beforeEach(async () => {
  mockInvoke.mockReset();
  mockListen.mockReset();
  mockListen.mockResolvedValue(() => {});

  vi.resetModules();
  const mod = await import('../HookService');
  hookService = mod.hookService;
});

describe('HookService', () => {
  describe('installHooks', () => {
    it('invokes hooks_install with agent type', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await hookService.installHooks('claude');

      expect(mockInvoke).toHaveBeenCalledWith('hooks_install', { agentType: 'claude' });
    });

    it('works with different agent types', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await hookService.installHooks('codex');

      expect(mockInvoke).toHaveBeenCalledWith('hooks_install', { agentType: 'codex' });
    });

    it('propagates errors from invoke', async () => {
      mockInvoke.mockRejectedValue(new Error('Install failed'));

      await expect(hookService.installHooks('claude')).rejects.toThrow('Install failed');
    });
  });

  describe('uninstallHooks', () => {
    it('invokes hooks_uninstall with agent type', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await hookService.uninstallHooks('gemini');

      expect(mockInvoke).toHaveBeenCalledWith('hooks_uninstall', { agentType: 'gemini' });
    });

    it('propagates errors from invoke', async () => {
      mockInvoke.mockRejectedValue(new Error('Uninstall failed'));

      await expect(hookService.uninstallHooks('gemini')).rejects.toThrow('Uninstall failed');
    });
  });

  describe('checkStatus', () => {
    it('invokes hooks_check_status and returns result', async () => {
      const status: HookStatus = {
        agentType: 'claude',
        installed: true,
        supported: true,
      };
      mockInvoke.mockResolvedValue(status);

      const result = await hookService.checkStatus('claude');

      expect(mockInvoke).toHaveBeenCalledWith('hooks_check_status', { agentType: 'claude' });
      expect(result).toEqual(status);
    });

    it('returns not installed status', async () => {
      const status: HookStatus = {
        agentType: 'aider',
        installed: false,
        supported: true,
      };
      mockInvoke.mockResolvedValue(status);

      const result = await hookService.checkStatus('aider');

      expect(result.installed).toBe(false);
      expect(result.supported).toBe(true);
    });

    it('returns unsupported status', async () => {
      const status: HookStatus = {
        agentType: 'cursor',
        installed: false,
        supported: false,
      };
      mockInvoke.mockResolvedValue(status);

      const result = await hookService.checkStatus('cursor');

      expect(result.supported).toBe(false);
    });

    it('propagates errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Check failed'));

      await expect(hookService.checkStatus('claude')).rejects.toThrow('Check failed');
    });
  });

  describe('getAllStatus', () => {
    it('checks status for all 6 supported agents', async () => {
      const agents = ['claude', 'codex', 'gemini', 'aider', 'cursor', 'opencode'];
      mockInvoke.mockImplementation(async (_cmd: string, args: { agentType: string }) => ({
        agentType: args.agentType,
        installed: false,
        supported: true,
      }));

      await hookService.getAllStatus();

      const calls = mockInvoke.mock.calls.filter((c) => c[0] === 'hooks_check_status');
      expect(calls).toHaveLength(6);
      const calledAgents = calls.map((c) => c[1].agentType);
      expect(calledAgents).toEqual(agents);
    });

    it('returns a record keyed by agent type', async () => {
      mockInvoke.mockImplementation(async (_cmd: string, args: { agentType: string }) => ({
        agentType: args.agentType,
        installed: args.agentType === 'claude',
        supported: true,
      }));

      const result = await hookService.getAllStatus();

      expect(result.claude.installed).toBe(true);
      expect(result.codex.installed).toBe(false);
      expect(result.gemini.installed).toBe(false);
      expect(Object.keys(result)).toHaveLength(6);
    });

    it('propagates errors if any checkStatus fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(hookService.getAllStatus()).rejects.toThrow('Network error');
    });
  });

  describe('onHookEvent', () => {
    it('registers a listener for hook-event', () => {
      mockListen.mockResolvedValue(() => {});

      hookService.onHookEvent(vi.fn());

      expect(mockListen).toHaveBeenCalledWith('hook-event', expect.any(Function));
    });

    it('passes event payload to callback', async () => {
      let capturedHandler: ((event: { payload: HookEvent }) => void) | null = null;
      mockListen.mockImplementation(async (_event: string, handler: (event: { payload: HookEvent }) => void) => {
        capturedHandler = handler;
        return () => {};
      });

      const callback = vi.fn();
      hookService.onHookEvent(callback);

      // Wait for listen promise to resolve
      await vi.waitFor(() => expect(capturedHandler).not.toBeNull());

      const hookEvent: HookEvent = {
        laneId: 'lane-1',
        agentType: 'claude',
        eventType: 'permission_prompt',
        timestamp: Date.now(),
        message: 'Needs permission',
      };

      capturedHandler!({ payload: hookEvent });

      expect(callback).toHaveBeenCalledWith(hookEvent);
    });

    it('handles events without optional message', async () => {
      let capturedHandler: ((event: { payload: HookEvent }) => void) | null = null;
      mockListen.mockImplementation(async (_event: string, handler: (event: { payload: HookEvent }) => void) => {
        capturedHandler = handler;
        return () => {};
      });

      const callback = vi.fn();
      hookService.onHookEvent(callback);

      await vi.waitFor(() => expect(capturedHandler).not.toBeNull());

      const hookEvent: HookEvent = {
        laneId: 'lane-2',
        agentType: 'gemini',
        eventType: 'idle_prompt',
        timestamp: Date.now(),
      };

      capturedHandler!({ payload: hookEvent });

      expect(callback).toHaveBeenCalledWith(hookEvent);
      expect(callback.mock.calls[0][0].message).toBeUndefined();
    });

    it('returns an unsubscribe function', () => {
      mockListen.mockResolvedValue(() => {});

      const unsub = hookService.onHookEvent(vi.fn());

      expect(typeof unsub).toBe('function');
    });

    it('unsubscribe calls unlisten after listen resolves', async () => {
      const mockUnlisten = vi.fn();
      mockListen.mockResolvedValue(mockUnlisten);

      const unsub = hookService.onHookEvent(vi.fn());

      // Wait for listen to resolve so unlisten is assigned
      await vi.waitFor(() => {});
      // Small delay for the .then() to execute
      await new Promise((r) => setTimeout(r, 0));

      unsub();

      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('unsubscribe is safe to call before listen resolves', () => {
      // listen never resolves
      mockListen.mockReturnValue(new Promise(() => {}));

      const unsub = hookService.onHookEvent(vi.fn());

      // Should not throw
      expect(() => unsub()).not.toThrow();
    });

    it('handles multiple event types', async () => {
      let capturedHandler: ((event: { payload: HookEvent }) => void) | null = null;
      mockListen.mockImplementation(async (_event: string, handler: (event: { payload: HookEvent }) => void) => {
        capturedHandler = handler;
        return () => {};
      });

      const callback = vi.fn();
      hookService.onHookEvent(callback);

      await vi.waitFor(() => expect(capturedHandler).not.toBeNull());

      const events: HookEvent[] = [
        { laneId: 'lane-1', agentType: 'claude', eventType: 'permission_prompt', timestamp: 1000 },
        { laneId: 'lane-1', agentType: 'claude', eventType: 'idle_prompt', timestamp: 2000 },
        { laneId: 'lane-1', agentType: 'claude', eventType: 'waiting_for_input', timestamp: 3000 },
      ];

      events.forEach((e) => capturedHandler!({ payload: e }));

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback.mock.calls[0][0].eventType).toBe('permission_prompt');
      expect(callback.mock.calls[1][0].eventType).toBe('idle_prompt');
      expect(callback.mock.calls[2][0].eventType).toBe('waiting_for_input');
    });
  });
});
