/**
 * Vitest global setup file
 *
 * Provides common mocks and globals needed across all tests.
 */
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock localStorage for node/jsdom environment
const localStorageMap = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
  get length() {
    return localStorageMap.size;
  },
  key: (index: number) => [...localStorageMap.keys()][index] ?? null,
});

// Reset localStorage between tests
beforeEach(() => {
  localStorageMap.clear();
});
