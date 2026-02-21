/**
 * Centralized Tauri API mocks for testing
 *
 * Usage:
 *   import { mockInvoke, mockInvokeResponse, simulateEvent } from '../test-utils/tauri-mock';
 *
 *   // In your test file, call setupTauriMocks() or mock individual modules
 */
import { vi } from 'vitest';
import type { UnlistenFn } from '@tauri-apps/api/event';

// ==================== invoke mock ====================

type InvokeHandler = (command: string, args?: Record<string, unknown>) => unknown;

const invokeResponses = new Map<string, unknown>();
let invokeHandler: InvokeHandler | null = null;

/**
 * The mock invoke function. Checks registered responses first, then falls back
 * to the custom handler, then returns undefined.
 */
export const mockInvoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
  if (invokeResponses.has(command)) {
    const response = invokeResponses.get(command);
    if (typeof response === 'function') {
      return (response as (args?: Record<string, unknown>) => unknown)(args);
    }
    return response;
  }
  if (invokeHandler) {
    return invokeHandler(command, args);
  }
  return undefined;
});

/**
 * Register a static response for a specific invoke command.
 * Pass a function to compute the response dynamically based on args.
 */
export function mockInvokeResponse(
  command: string,
  response: unknown | ((args?: Record<string, unknown>) => unknown),
): void {
  invokeResponses.set(command, response);
}

/**
 * Set a catch-all invoke handler for commands without registered responses.
 */
export function setInvokeHandler(handler: InvokeHandler): void {
  invokeHandler = handler;
}

/**
 * Clear all invoke mocks and responses.
 */
export function clearInvokeMocks(): void {
  invokeResponses.clear();
  invokeHandler = null;
  mockInvoke.mockClear();
}

// ==================== event mock ====================

type EventCallback = (event: { payload: unknown }) => void;

const eventListeners = new Map<string, Set<EventCallback>>();

export const mockListen = vi.fn(
  async (eventName: string, callback: EventCallback): Promise<UnlistenFn> => {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    eventListeners.get(eventName)!.add(callback);

    return () => {
      eventListeners.get(eventName)?.delete(callback);
    };
  },
);

export const mockEmit = vi.fn();

/**
 * Simulate a Tauri event being fired.
 */
export function simulateEvent(eventName: string, payload: unknown): void {
  const listeners = eventListeners.get(eventName);
  if (listeners) {
    for (const cb of listeners) {
      cb({ payload });
    }
  }
}

export function clearEventMocks(): void {
  eventListeners.clear();
  mockListen.mockClear();
  mockEmit.mockClear();
}

// ==================== window mock ====================

export const mockGetCurrentWindow = vi.fn(() => ({
  setTitle: vi.fn(),
  close: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  isMaximized: vi.fn(async () => false),
}));

// ==================== app mock ====================

export const mockGetVersion = vi.fn(async () => '0.1.0-test');

// ==================== Module mock setup functions ====================

/**
 * Call this at the top of your test file (before imports) to mock all Tauri modules.
 * Alternatively, mock individual modules as needed.
 */
export function setupTauriMocks(): void {
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: mockInvoke,
  }));

  vi.mock('@tauri-apps/api/event', () => ({
    listen: mockListen,
    emit: mockEmit,
  }));

  vi.mock('@tauri-apps/api/window', () => ({
    getCurrentWindow: mockGetCurrentWindow,
  }));

  vi.mock('@tauri-apps/api/app', () => ({
    getVersion: mockGetVersion,
  }));

  vi.mock('@tauri-apps/plugin-notification', () => ({
    isPermissionGranted: vi.fn(async () => true),
    requestPermission: vi.fn(async () => 'granted'),
    sendNotification: vi.fn(),
  }));

  vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
    writeText: vi.fn(),
    readText: vi.fn(async () => ''),
  }));

  vi.mock('@tauri-apps/plugin-sql', () => ({
    default: {
      load: vi.fn(async () => ({
        execute: vi.fn(),
        select: vi.fn(async () => []),
      })),
    },
  }));

  vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn(),
    save: vi.fn(),
    message: vi.fn(),
    confirm: vi.fn(async () => true),
  }));

  vi.mock('@tauri-apps/plugin-fs', () => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readDir: vi.fn(async () => []),
    exists: vi.fn(async () => false),
  }));

  vi.mock('@tauri-apps/plugin-shell', () => ({
    Command: {
      create: vi.fn(),
    },
  }));
}

/**
 * Reset all Tauri mocks between tests.
 */
export function resetTauriMocks(): void {
  clearInvokeMocks();
  clearEventMocks();
  mockGetCurrentWindow.mockClear();
  mockGetVersion.mockClear();
}
