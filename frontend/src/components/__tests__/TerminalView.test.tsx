import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { TerminalView } from '../TerminalView';
import { createSignal } from 'solid-js';

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

// Mock terminal and fit addon
let scrollCallback: (() => void) | null = null;
const mockTerminalInstance = {
  open: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
  onScroll: vi.fn((cb) => {
    scrollCallback = cb;
    return { dispose: vi.fn() };
  }),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onTitleChange: vi.fn(() => ({ dispose: vi.fn() })),
  attachCustomKeyEventHandler: vi.fn(),
  loadAddon: vi.fn(),
  write: vi.fn(),
  scrollToBottom: vi.fn(),
  refresh: vi.fn(),
  cols: 80,
  rows: 24,
  buffer: {
    active: {
      viewportY: 0,
      baseY: 0,
      rows: 24,
      length: 24,
    },
  },
};

// Mock TerminalPool with reactivity
let mockHandle: any;
let setMockHandle: any;

const mockTerminalPool = {
  acquire: vi.fn(async () => mockHandle()),
  release: vi.fn(async () => {}),
};

vi.mock('../../hooks/useTerminalPool', () => ({
  useTerminalPool: () => mockTerminalPool,
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
  getLaneAgentConfig: vi.fn(async () => ({ agentType: 'shell', command: 'zsh', args: [], env: {}, useLaneCwd: true, name: 'Shell' })),
  checkCommandExists: vi.fn(async () => '/bin/zsh'),
}));

vi.mock('../../lib/terminal-utils', () => ({
  createTerminal: () => mockTerminalInstance,
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
    mockTerminalInstance.buffer.active.viewportY = 0;
    mockTerminalInstance.buffer.active.baseY = 0;
    mockTerminalInstance.buffer.active.length = 24;
    
    const initialHandle = {
      id: 'lane-1-agent',
      terminal: mockTerminalInstance,
      pty: {
        id: 'pty-1',
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn(),
        onData: vi.fn(async () => () => {}),
        onExit: vi.fn(async () => () => {}),
      },
      autoScroll: true,
    };

    // Setup reactive handle
    const [h, s] = createSignal(initialHandle);
    mockHandle = h;
    setMockHandle = s;
  });

  it('shows "Scroll to Bottom" button when user scrolls up', async () => {
    // Start with autoScroll false so button can show
    const current = { ...mockHandle() };
    current.autoScroll = false;
    setMockHandle(current);
    
    render(() => <TerminalView laneId="lane-1" />);

    // Wait for handle to be set
    await waitFor(() => expect(mockTerminalPool.acquire).toHaveBeenCalled());

    // Simulate user scrolling up
    mockTerminalInstance.buffer.active.baseY = 76; 
    mockTerminalInstance.buffer.active.viewportY = 0;
    mockTerminalInstance.buffer.active.length = 100;
    
    // Trigger the scroll callback
    if (scrollCallback) scrollCallback();

    // The button should now be visible
    const button = await screen.findByTestId('scroll-to-bottom-button');
    expect(button).toBeDefined();
  });
});
