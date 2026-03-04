import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TerminalHandle } from '../../types/terminal';

// --- Mocks ---

// Mock PtyHandle
const mockPtyWrite = vi.fn();
const mockPtyResize = vi.fn();
const mockPtyKill = vi.fn();
let ptyDataCallback: ((data: Uint8Array) => void) | null = null;
let ptyExitCallback: ((code: number | null) => void) | null = null;

const mockSpawn = vi.fn(async () => ({
  id: 'pty-mock-1',
  write: mockPtyWrite,
  resize: mockPtyResize,
  kill: mockPtyKill,
  onData: vi.fn(async (cb: (data: Uint8Array) => void) => {
    ptyDataCallback = cb;
    return () => {};
  }),
  onExit: vi.fn(async (cb: (code: number | null) => void) => {
    ptyExitCallback = cb;
    return () => {};
  }),
}));

vi.mock('../PortablePty', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

// Mock settings-api
const mockGetLaneAgentConfig = vi.fn();
const mockCheckCommandExists = vi.fn();
vi.mock('../../lib/settings-api', () => ({
  getLaneAgentConfig: (...args: unknown[]) => mockGetLaneAgentConfig(...args),
  checkCommandExists: (...args: unknown[]) => mockCheckCommandExists(...args),
}));

// Mock terminal with scrolling behavior
function createMockTerminal() {
  const scrollToBottom = vi.fn();
  const write = vi.fn();
  const onData = vi.fn((_cb: (data: string) => void) => ({ dispose: vi.fn() }));
  const dispose = vi.fn();
  const loadAddon = vi.fn();
  const attachCustomKeyEventHandler = vi.fn();
  const focus = vi.fn();

  return {
    terminal: {
      cols: 80,
      rows: 24,
      write,
      scrollToBottom,
      onData,
      dispose,
      loadAddon,
      attachCustomKeyEventHandler,
      focus,
      element: null,
      buffer: {
        active: { baseY: 0, length: 24 },
      },
      hasSelection: () => false,
      options: {},
    },
    scrollToBottom,
    write,
  };
}

const mockTerminals: ReturnType<typeof createMockTerminal>[] = [];

vi.mock('../../lib/terminal-utils', () => ({
  createTerminal: () => {
    const mock = createMockTerminal();
    mockTerminals.push(mock);
    return mock.terminal;
  },
  createFitAddon: () => ({ fit: vi.fn() }),
  attachKeyHandlers: vi.fn(() => () => {}),
  loadAddons: vi.fn(),
  updateTerminalTheme: vi.fn(),
}));

// Mock theme
vi.mock('../../theme', () => ({
  getTerminalTheme: () => ({}),
}));

let terminalPool: typeof import('../TerminalPool')['terminalPool'];

beforeEach(async () => {
  mockSpawn.mockClear();
  mockPtyWrite.mockClear();
  mockPtyResize.mockClear();
  mockPtyKill.mockClear();
  mockGetLaneAgentConfig.mockReset();
  mockCheckCommandExists.mockReset();
  mockTerminals.length = 0;
  ptyDataCallback = null;
  ptyExitCallback = null;

  // Default: shell agent (skips agent spawn, goes straight to shell)
  mockGetLaneAgentConfig.mockResolvedValue({
    agentType: 'shell',
    command: 'zsh',
  });

  vi.resetModules();
  const mod = await import('../TerminalPool');
  terminalPool = mod.terminalPool;
});

describe('TerminalPool', () => {
  describe('sticky scroll', () => {
    it('creates handle with autoScroll defaulting to true', async () => {
      const handle = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });

      expect(handle.autoScroll).toBe(true);
    });

    it('calls scrollToBottom after PTY write when autoScroll is true', async () => {
      const handle = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const { scrollToBottom, write } = mockTerminals[0];

      expect(handle.autoScroll).toBe(true);

      // Simulate PTY output
      const data = new TextEncoder().encode('hello world');
      ptyDataCallback!(data);

      expect(write).toHaveBeenCalledWith(data);
      expect(scrollToBottom).toHaveBeenCalled();
    });

    it('does NOT call scrollToBottom when autoScroll is false', async () => {
      const handle = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const { scrollToBottom, write } = mockTerminals[0];

      // Simulate user scrolling up
      handle.autoScroll = false;

      // Simulate PTY output
      const data = new TextEncoder().encode('hello world');
      ptyDataCallback!(data);

      expect(write).toHaveBeenCalledWith(data);
      expect(scrollToBottom).not.toHaveBeenCalled();
    });

    it('resumes scrollToBottom when autoScroll is re-enabled', async () => {
      const handle = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const { scrollToBottom, write } = mockTerminals[0];

      // User scrolls up
      handle.autoScroll = false;
      ptyDataCallback!(new TextEncoder().encode('line 1'));
      expect(scrollToBottom).not.toHaveBeenCalled();

      // User scrolls back to bottom
      handle.autoScroll = true;
      ptyDataCallback!(new TextEncoder().encode('line 2'));
      expect(scrollToBottom).toHaveBeenCalledTimes(1);
    });

    it('does NOT call scrollToBottom if user is scrolled up even if autoScroll is true', async () => {
      const handle = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const { terminal, scrollToBottom } = mockTerminals[0];

      expect(handle.autoScroll).toBe(true);

      // Simulate user being scrolled up (baseY is 0, length is 100)
      terminal.buffer.active.baseY = 0;
      terminal.buffer.active.length = 100;
      // 0 + 24 < 100, so we're scrolled up

      // Simulate PTY output
      const data = new TextEncoder().encode('new output');
      ptyDataCallback!(data);

      // Should not scroll because isAtBottom was false before the write
      expect(scrollToBottom).not.toHaveBeenCalled();
    });
  });

  describe('scroll position detection', () => {
    it('detects at-bottom when baseY + rows >= length', () => {
      // This tests the logic: buffer.baseY + terminal.rows >= buffer.length
      const cases = [
        { baseY: 0, rows: 24, length: 24, expected: true },   // exactly at bottom
        { baseY: 10, rows: 24, length: 34, expected: true },   // scrollback, at bottom
        { baseY: 10, rows: 24, length: 35, expected: false },  // 1 line scrolled up
        { baseY: 0, rows: 24, length: 50, expected: false },   // scrolled to top
        { baseY: 100, rows: 24, length: 124, expected: true }, // large buffer, at bottom
        { baseY: 100, rows: 24, length: 125, expected: false }, // large buffer, 1 line up
      ];

      for (const { baseY, rows, length, expected } of cases) {
        const isAtBottom = baseY + rows >= length;
        expect(isAtBottom).toBe(expected);
      }
    });
  });

  describe('acquire and release', () => {
    it('returns existing handle on re-acquire', async () => {
      const handle1 = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const handle2 = await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });

      expect(handle1).toBe(handle2);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('releases and cleans up terminal', async () => {
      await terminalPool.acquire({ id: 'lane-1-tab-t1', laneId: 'lane-1', cwd: '/tmp' });
      const { terminal } = mockTerminals[0];

      await terminalPool.release('lane-1-tab-t1');

      expect(mockPtyKill).toHaveBeenCalled();
      expect(terminal.dispose).toHaveBeenCalled();
      expect(terminalPool.getHandle('lane-1-tab-t1')).toBeUndefined();
    });
  });
});
