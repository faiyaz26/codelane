import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@solidjs/testing-library';
import { GlobalNotifications } from '../GlobalNotifications';
import { agentStatusManager } from '../../services/AgentStatusManager';
import type { AgentStatusChange } from '../../types/agentStatus';

// Mock agentStatusManager
vi.mock('../../services/AgentStatusManager', () => ({
  agentStatusManager: {
    onStatusChange: vi.fn(),
    getNotificationSettings: vi.fn(),
  }
}));

describe('GlobalNotifications', () => {
  let statusChangeCallback: (change: AgentStatusChange) => void;
  let unmount: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(agentStatusManager.onStatusChange).mockImplementation((cb) => {
      statusChangeCallback = cb;
      return vi.fn(); // unsubscribe
    });
    vi.mocked(agentStatusManager.getNotificationSettings).mockReturnValue({
      notifyOnDone: true,
      notifyOnWaitingForInput: true,
      notifyOnError: true,
      onlyWhenUnfocused: false,
    });
  });

  afterEach(() => {
    if (unmount) unmount();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders nothing initially', () => {
    const { container, unmount: u } = render(() => (
      <GlobalNotifications
        lanes={[]}
        activeLaneId="lane1"
        onLaneSelect={vi.fn()}
        onSettingsOpen={vi.fn()}
      />
    ));
    unmount = u;
    expect(container.innerHTML).toBe('');
  });

  it('shows notification when agent finishes task in inactive lane', () => {
    const { container, unmount: u } = render(() => (
      <GlobalNotifications
        lanes={[{ id: 'lane2', name: 'Lane 2', path: '/path' } as any]}
        activeLaneId="lane1"
        onLaneSelect={vi.fn()}
        onSettingsOpen={vi.fn()}
      />
    ));
    unmount = u;

    // Simulate status change
    statusChangeCallback({
      laneId: 'lane2',
      previousStatus: 'working',
      newStatus: 'done',
      agentType: 'claude',
      timestamp: Date.now()
    });

    // Check if notification is shown
    expect(container.innerHTML).toContain('Agent finished task in "Lane 2"');
  });

  it('does not show notification if lane is active', () => {
    const { container, unmount: u } = render(() => (
      <GlobalNotifications
        lanes={[{ id: 'lane1', name: 'Lane 1', path: '/path' } as any]}
        activeLaneId="lane1"
        onLaneSelect={vi.fn()}
        onSettingsOpen={vi.fn()}
      />
    ));
    unmount = u;

    // Simulate status change
    statusChangeCallback({
      laneId: 'lane1', // This is the active lane
      previousStatus: 'working',
      newStatus: 'done',
      agentType: 'claude',
      timestamp: Date.now()
    });

    // Should not show notification
    expect(container.innerHTML).toBe('');
  });

  it('shows notification for agent failure event', () => {
    const { container, unmount: u } = render(() => (
      <GlobalNotifications
        lanes={[]}
        activeLaneId="lane1"
        onLaneSelect={vi.fn()}
        onSettingsOpen={vi.fn()}
      />
    ));
    unmount = u;

    // Dispatch global event
    window.dispatchEvent(new CustomEvent('codelane:agent-failed', {
      detail: { agentType: 'copilot', command: 'copilot' }
    }));

    // Check if notification is shown
    expect(container.innerHTML).toContain('Agent "copilot" (copilot) is not installed.');  });
});
