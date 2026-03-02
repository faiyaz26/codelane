import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { TerminalView } from '../TerminalView';

// --- Mocks ---

// Mock matchMedia for xterm.js
vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

// Mock PortablePty
const mockPty = {
  id: 'pty-1',
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
  onData: vi.fn(async () => () => {}),
  onExit: vi.fn(async () => () => {}),
};
vi.mock('../../services/PortablePty', () => ({
  spawn: vi.fn(async () => mockPty),
}));

// Mock AgentStatusManager
vi.mock('../../services/AgentStatusManager', () => ({
  agentStatusManager: {
    registerLane: vi.fn(async () => {}),
    unregisterLane: vi.fn(),
    onStatusChange: vi.fn(() => () => {}),
    shouldShowNotificationPrompt: vi.fn(() => false),
    feedOutput: vi.fn(),
    feedUserInput: vi.fn(),
    feedWindowTitle: vi.fn(),
    markExited: vi.fn(),
    getStatus: vi.fn(() => 'idle'),
    getNotificationSettings: vi.fn(() => ({ notifyOnDone: false, notifyOnWaitingForInput: false, notifyOnError: false })),
    updateNotificationSettings: vi.fn(),
    dismissNotificationPrompt: vi.fn(),
  },
}));

// Mock settings-api
vi.mock('../../lib/settings-api', () => ({
  getLaneAgentConfig: vi.fn(async () => ({ agentType: 'shell', command: 'zsh', args: [], env: {}, useLaneCwd: true })),
  checkCommandExists: vi.fn(async () => '/bin/zsh'),
}));

// Mock terminal and fit addon
let scrollCallback: (() => void) | null = null;
const mockTerminal = {
  open: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  onScroll: vi.fn((cb) => {
    scrollCallback = cb;
    return { dispose: vi.fn() };
  }),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onTitleChange: vi.fn(() => ({ dispose: vi.fn() })),
  write: vi.fn(),
  scrollToBottom: vi.fn(),
  refresh: vi.fn(),
  cols: 80,
  rows: 24,
  buffer: {
    active: {
      baseY: 0,
      rows: 24,
      length: 24,
    },
  },
};

vi.mock('../../lib/terminal-utils', () => ({
  createTerminal: () => mockTerminal,
  createFitAddon: () => ({ fit: vi.fn() }),
  loadAddons: vi.fn(),
  attachKeyHandlers: vi.fn(),
  updateTerminalTheme: vi.fn(),
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}));

describe('TerminalView Scrolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrollCallback = null;
    mockTerminal.buffer.active.baseY = 0;
    mockTerminal.buffer.active.length = 24;
  });

  it('shows "Scroll to Bottom" button when user scrolls up', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    // Wait for initialization
    const { agentStatusManager } = await import('../../services/AgentStatusManager');
    await waitFor(() => expect(agentStatusManager.registerLane).toHaveBeenCalled());

    // Simulate user scrolling up
    mockTerminal.buffer.active.baseY = 0;
    mockTerminal.buffer.active.length = 100;
    
    // Trigger the scroll callback
    if (scrollCallback) scrollCallback();

    // The button should now be visible
    const button = await screen.findByText('Scroll to Bottom');
    expect(button).toBeDefined();
  });

  it('hides "Scroll to Bottom" button and calls scrollToBottom when clicked', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    const { agentStatusManager } = await import('../../services/AgentStatusManager');
    await waitFor(() => expect(agentStatusManager.registerLane).toHaveBeenCalled());

    // Scroll up
    mockTerminal.buffer.active.baseY = 0;
    mockTerminal.buffer.active.length = 100;
    if (scrollCallback) scrollCallback();

    const button = await screen.findByText('Scroll to Bottom');
    fireEvent.click(button);

    expect(mockTerminal.scrollToBottom).toHaveBeenCalled();
    
    // After clicking, the button should eventually disappear
    await waitFor(() => expect(screen.queryByText('Scroll to Bottom')).toBeNull());
  });

  it('hides button automatically when user scrolls back to bottom', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    const { agentStatusManager } = await import('../../services/AgentStatusManager');
    await waitFor(() => expect(agentStatusManager.registerLane).toHaveBeenCalled());

    // Scroll up
    mockTerminal.buffer.active.baseY = 0;
    mockTerminal.buffer.active.length = 100;
    if (scrollCallback) scrollCallback();

    expect(await screen.findByText('Scroll to Bottom')).toBeDefined();

    // Scroll back to bottom
    mockTerminal.buffer.active.baseY = 76; // 76 + 24 = 100
    if (scrollCallback) scrollCallback();

    await waitFor(() => expect(screen.queryByText('Scroll to Bottom')).toBeNull());
  });
});
