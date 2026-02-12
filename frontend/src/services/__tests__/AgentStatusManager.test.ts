import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentStatusChange } from '../../types/agentStatus';

// Mock localStorage for node environment
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

// Mock solid-js/store
vi.mock('solid-js/store', () => {
  return {
    createStore: <T extends object>(init: T): [T, (key: string, value: unknown) => void] => {
      const store = { ...init } as Record<string, unknown>;
      const setStore = (key: string, value: unknown) => {
        store[key] = value;
      };
      return [store as T, setStore as unknown as (key: string, value: unknown) => void];
    },
  };
});

let agentStatusManager: typeof import('../AgentStatusManager')['agentStatusManager'];

beforeEach(async () => {
  vi.useFakeTimers();
  localStorageMap.clear();
  vi.resetModules();
  const mod = await import('../AgentStatusManager');
  agentStatusManager = mod.agentStatusManager;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AgentStatusManager', () => {
  it('registerLane initializes status to idle', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('feedOutput transitions to working', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('some output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
  });

  it('feedOutput is no-op for unregistered lane', () => {
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('nonexistent', data);
  });

  it('markExited resets status to idle', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    agentStatusManager.markExited('lane-1');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('markExited is no-op for unregistered lane', () => {
    agentStatusManager.markExited('nonexistent');
  });

  it('unregisterLane removes the lane', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.unregisterLane('lane-1');
    expect(agentStatusManager.getStatus('lane-1')).toBeUndefined();
  });

  it('unregisterLane is no-op for unregistered lane', () => {
    agentStatusManager.unregisterLane('nonexistent');
  });

  it('re-registering a lane disposes previous detector', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    agentStatusManager.registerLane('lane-1', 'aider');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('onStatusChange listener receives events', () => {
    const changes: AgentStatusChange[] = [];
    agentStatusManager.onStatusChange((change) => changes.push(change));

    agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);

    expect(changes).toHaveLength(1);
    expect(changes[0].laneId).toBe('lane-1');
    expect(changes[0].previousStatus).toBe('idle');
    expect(changes[0].newStatus).toBe('working');
    expect(changes[0].agentType).toBe('claude');
    expect(changes[0].timestamp).toBeGreaterThan(0);
  });

  it('onStatusChange returns unsubscribe function', () => {
    const changes: AgentStatusChange[] = [];
    const unsub = agentStatusManager.onStatusChange((change) => changes.push(change));

    agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('output'));
    expect(changes).toHaveLength(1);

    unsub();
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('Error: fail'));
    expect(changes).toHaveLength(1);
  });

  it('supports multiple lanes independently', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.registerLane('lane-2', 'aider');

    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('working'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
    expect(agentStatusManager.getStatus('lane-2')).toBe('idle');

    agentStatusManager.feedOutput('lane-2', new TextEncoder().encode('aider> '));
    expect(agentStatusManager.getStatus('lane-2')).toBe('waiting_for_input');
  });

  it('idle timeout triggers done', () => {
    agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('output'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    vi.advanceTimersByTime(4100);
    expect(agentStatusManager.getStatus('lane-1')).toBe('done');
  });

  it('getStatusStore returns the reactive store', () => {
    const store = agentStatusManager.getStatusStore();
    agentStatusManager.registerLane('lane-1', 'claude');
    expect(store['lane-1']).toBe('idle');
  });

  it('getNotificationSettings returns defaults', () => {
    const settings = agentStatusManager.getNotificationSettings();
    expect(settings.notifyOnDone).toBe(false);
    expect(settings.notifyOnWaitingForInput).toBe(false);
    expect(settings.notifyOnError).toBe(false);
    expect(settings.onlyWhenUnfocused).toBe(true);
  });

  it('updateNotificationSettings persists and retrieves', () => {
    agentStatusManager.updateNotificationSettings({ notifyOnDone: true });
    const settings = agentStatusManager.getNotificationSettings();
    expect(settings.notifyOnDone).toBe(true);
    expect(settings.notifyOnWaitingForInput).toBe(false);
  });

  it('shouldShowNotificationPrompt returns true when notifications are off', () => {
    expect(agentStatusManager.shouldShowNotificationPrompt()).toBe(true);
  });

  it('shouldShowNotificationPrompt returns false when both enabled', () => {
    agentStatusManager.updateNotificationSettings({ notifyOnDone: true, notifyOnWaitingForInput: true });
    expect(agentStatusManager.shouldShowNotificationPrompt()).toBe(false);
  });

  it('dismissNotificationPrompt prevents prompt from showing', () => {
    agentStatusManager.dismissNotificationPrompt();
    expect(agentStatusManager.shouldShowNotificationPrompt()).toBe(false);
  });
});
