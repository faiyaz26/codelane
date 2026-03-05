import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentStatusChange } from '../../types/agentStatus';

// Mock HookService
vi.mock('../HookService', () => ({
  hookService: {
    checkStatus: vi.fn(async () => ({ isInstalled: false, agentType: 'claude' })),
    onHookEvent: vi.fn(() => () => {}),
  },
}));

// Mock localStorage for node environment
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
});

let agentStatusManager: typeof import('../AgentStatusManager')['agentStatusManager'];
let hookService: any;

beforeEach(async () => {
  vi.useFakeTimers();
  localStorageMap.clear();
  vi.resetModules();
  const mod = await import('../AgentStatusManager');
  agentStatusManager = mod.agentStatusManager;
  const hookMod = await import('../HookService');
  hookService = hookMod.hookService;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AgentStatusManager', () => {
  it('registerLane initializes status to idle', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('feedOutput transitions to working', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('some output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
  });

  it('feedOutput is no-op for unregistered lane', () => {
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('nonexistent', data);
  });

  it('markExited resets status to idle', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    agentStatusManager.markExited('lane-1');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('markExited is no-op for unregistered lane', () => {
    agentStatusManager.markExited('nonexistent');
  });

  it('unregisterLane removes the lane', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.unregisterLane('lane-1');
    expect(agentStatusManager.getStatus('lane-1')).toBeUndefined();
  });

  it('unregisterLane is no-op for unregistered lane', () => {
    agentStatusManager.unregisterLane('nonexistent');
  });

  it('re-registering a lane disposes previous detector', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    await agentStatusManager.registerLane('lane-1', 'copilot');
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');
  });

  it('onStatusChange listener receives events', async () => {
    const changes: AgentStatusChange[] = [];
    agentStatusManager.onStatusChange((change) => changes.push(change));

    await agentStatusManager.registerLane('lane-1', 'claude');
    const data = new TextEncoder().encode('output');
    agentStatusManager.feedOutput('lane-1', data);

    expect(changes).toHaveLength(1);
    expect(changes[0].laneId).toBe('lane-1');
    expect(changes[0].previousStatus).toBe('idle');
    expect(changes[0].newStatus).toBe('working');
    expect(changes[0].agentType).toBe('claude');
    expect(changes[0].timestamp).toBeGreaterThan(0);
  });

  it('onStatusChange returns unsubscribe function', async () => {
    const changes: AgentStatusChange[] = [];
    const unsub = agentStatusManager.onStatusChange((change) => changes.push(change));

    await agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('output'));
    expect(changes).toHaveLength(1);

    unsub();
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('Error: fail'));
    expect(changes).toHaveLength(1);
  });

  it('supports multiple lanes independently', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    await agentStatusManager.registerLane('lane-2', 'copilot');

    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('working'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
    expect(agentStatusManager.getStatus('lane-2')).toBe('idle');

    agentStatusManager.feedOutput('lane-2', new TextEncoder().encode('? '));
    expect(agentStatusManager.getStatus('lane-2')).toBe('waiting_for_input');
  });

  it('idle timeout triggers done', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('output'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    vi.advanceTimersByTime(4100);
    expect(agentStatusManager.getStatus('lane-1')).toBe('done');
  });

  it('feedUserInput + non-prompt output transitions from waiting_for_input to working', async () => {
    await agentStatusManager.registerLane('lane-1', 'claude');
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('Do you want to proceed?'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('waiting_for_input');

    agentStatusManager.feedUserInput('lane-1', 'y');
    // Still waiting — flag set but no non-prompt output yet
    expect(agentStatusManager.getStatus('lane-1')).toBe('waiting_for_input');

    // Agent starts processing
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('Processing...'));
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
  });

  it('feedUserInput is no-op for unregistered lane', () => {
    agentStatusManager.feedUserInput('nonexistent', 'y');
  });

  it('getStatusStore returns the reactive store', async () => {
    const store = agentStatusManager.getStatusStore();
    await agentStatusManager.registerLane('lane-1', 'claude');
    expect(store['lane-1']).toBe('idle');
  });

  it('hooks prioritize over heuristic detection', async () => {
    vi.mocked(hookService.checkStatus).mockResolvedValueOnce({ isInstalled: true, agentType: 'claude' });
    
    // Capture the hook event callback
    let hookCallback: any;
    vi.mocked(hookService.onHookEvent).mockImplementation((cb: any) => {
      hookCallback = cb;
      return () => {};
    });

    // Re-import to get fresh state with mocked hook callback
    vi.resetModules();
    const mod = await import('../AgentStatusManager');
    agentStatusManager = mod.agentStatusManager;

    await agentStatusManager.registerLane('lane-1', 'claude');
    
    // Status should be idle (override)
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');

    // Feed output that would normally trigger 'working'
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('working...'));
    // Should still be idle because hook override is active
    expect(agentStatusManager.getStatus('lane-1')).toBe('idle');

    // Trigger hook event
    hookCallback({ 
      laneId: 'lane-1', 
      eventType: 'working', 
      agentType: 'claude', 
      timestamp: Date.now() 
    });
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');

    // Feed output that would trigger 'waiting_for_input'
    agentStatusManager.feedOutput('lane-1', new TextEncoder().encode('Continue? [y/n]'));
    // Should still be 'working' from hook override
    expect(agentStatusManager.getStatus('lane-1')).toBe('working');
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
