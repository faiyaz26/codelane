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
let scrollCallback: ((viewportY: number) => void) | null = null;
let wheelCallback: ((event: WheelEvent) => boolean) | null = null;
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
  attachCustomWheelEventHandler: vi.fn((cb) => {
    wheelCallback = cb;
  }),
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
  isTerminalViewportAtBottom: (terminal: any, viewportY = terminal.buffer.active.viewportY) =>
    viewportY >= terminal.buffer.active.baseY,
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
    wheelCallback = null;
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

  it('keeps the scroll-to-bottom button hidden when the terminal is manually scrolled up', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    await waitFor(() => expect(mockTerminalPool.acquire).toHaveBeenCalled());
    await waitFor(() => expect(scrollCallback).not.toBeNull());

    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();

    // Simulate user scrolling up
    mockTerminalInstance.buffer.active.baseY = 76;
    mockTerminalInstance.buffer.active.viewportY = 0;
    mockTerminalInstance.buffer.active.length = 100;

    scrollCallback?.(0);

    expect(mockHandle().autoScroll).toBe(false);
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();
  });

  it('still disables auto-scroll from xterm scroll events before buffer viewport state catches up', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    await waitFor(() => expect(mockTerminalPool.acquire).toHaveBeenCalled());
    await waitFor(() => expect(scrollCallback).not.toBeNull());

    mockTerminalInstance.buffer.active.baseY = 76;
    mockTerminalInstance.buffer.active.viewportY = 76;
    mockTerminalInstance.buffer.active.length = 100;

    scrollCallback?.(0);

    expect(mockHandle().autoScroll).toBe(false);
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();
  });

  it('pauses auto-scroll as soon as the user wheels upward', async () => {
    render(() => <TerminalView laneId="lane-1" />);

    await waitFor(() => expect(mockTerminalPool.acquire).toHaveBeenCalled());
    await waitFor(() => expect(wheelCallback).not.toBeNull());

    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();

    const shouldContinue = wheelCallback?.({
      deltaY: -1,
    } as WheelEvent);

    expect(shouldContinue).toBe(true);
    expect(mockHandle().autoScroll).toBe(false);
    expect(screen.queryByTestId('scroll-to-bottom-button')).not.toBeInTheDocument();
  });
});
