import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentStatusChange, AgentNotificationSettings } from '../../types/agentStatus';

// Mock document.hasFocus for node environment
let mockHasFocus = true;
vi.stubGlobal('document', { hasFocus: () => mockHasFocus });

// Track status change listeners registered with the manager
let statusChangeListeners: Array<(change: AgentStatusChange) => void> = [];
let mockNotificationSettings: AgentNotificationSettings;

// All-enabled settings for tests that expect notifications to fire
const ALL_ENABLED: AgentNotificationSettings = {
  notifyOnDone: true,
  notifyOnWaitingForInput: true,
  notifyOnError: true,
  onlyWhenUnfocused: false,
};

// Mock AgentStatusManager
vi.mock('../AgentStatusManager', () => ({
  agentStatusManager: {
    onStatusChange: vi.fn((listener: (change: AgentStatusChange) => void) => {
      statusChangeListeners.push(listener);
      return () => {
        statusChangeListeners = statusChangeListeners.filter((l) => l !== listener);
      };
    }),
    getNotificationSettings: vi.fn(() => ({ ...mockNotificationSettings })),
  },
}));

// Mock Tauri notification plugin
const mockSendNotification = vi.fn();
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => 'granted'),
  sendNotification: mockSendNotification,
}));

let agentNotificationService: typeof import('../AgentNotificationService')['agentNotificationService'];

beforeEach(async () => {
  statusChangeListeners = [];
  mockNotificationSettings = { ...ALL_ENABLED };
  mockHasFocus = true;
  mockSendNotification.mockClear();

  vi.resetModules();
  const mod = await import('../AgentNotificationService');
  agentNotificationService = mod.agentNotificationService;
});

afterEach(() => {
  agentNotificationService.stop();
});

function fireStatusChange(change: Partial<AgentStatusChange>): void {
  const fullChange: AgentStatusChange = {
    laneId: 'lane-1',
    previousStatus: 'working',
    newStatus: 'done',
    agentType: 'claude',
    timestamp: Date.now(),
    ...change,
  };
  for (const listener of statusChangeListeners) {
    listener(fullChange);
  }
}

describe('AgentNotificationService', () => {
  it('subscribes to status changes on start', async () => {
    await agentNotificationService.start();
    expect(statusChangeListeners).toHaveLength(1);
  });

  it('unsubscribes on stop', async () => {
    await agentNotificationService.start();
    expect(statusChangeListeners).toHaveLength(1);

    agentNotificationService.stop();
    expect(statusChangeListeners).toHaveLength(0);
  });

  it('fires notification on done status', async () => {
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'done' });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Agent Finished',
      body: 'claude in lane completed its task.',
    });
  });

  it('fires notification on waiting_for_input status', async () => {
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'waiting_for_input' });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Agent Needs Input',
      body: 'claude is waiting for your input.',
    });
  });

  it('fires notification on error status', async () => {
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'error' });

    expect(mockSendNotification).toHaveBeenCalledWith({
      title: 'Agent Error',
      body: 'claude encountered an error.',
    });
  });

  it('does not fire notification when notifyOnDone is disabled', async () => {
    mockNotificationSettings.notifyOnDone = false;
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'done' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not fire notification when notifyOnWaitingForInput is disabled', async () => {
    mockNotificationSettings.notifyOnWaitingForInput = false;
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'waiting_for_input' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not fire notification when notifyOnError is disabled', async () => {
    mockNotificationSettings.notifyOnError = false;
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'error' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not fire for working status', async () => {
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'working' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not fire for idle status', async () => {
    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'idle' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not fire when onlyWhenUnfocused and window has focus', async () => {
    mockNotificationSettings.onlyWhenUnfocused = true;
    mockHasFocus = true;

    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'done' });

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('fires when onlyWhenUnfocused and window does not have focus', async () => {
    mockNotificationSettings.onlyWhenUnfocused = true;
    mockHasFocus = false;

    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'done' });

    expect(mockSendNotification).toHaveBeenCalled();
  });

  it('fires when onlyWhenUnfocused is false even if window has focus', async () => {
    mockNotificationSettings.onlyWhenUnfocused = false;
    mockHasFocus = true;

    await agentNotificationService.start();
    fireStatusChange({ newStatus: 'done' });

    expect(mockSendNotification).toHaveBeenCalled();
  });
});
