/**
 * SolidJS store mock for use in node environment tests.
 *
 * When testing services that use `createStore` from `solid-js/store`,
 * import this mock to get a simple non-reactive implementation.
 *
 * Usage in test files:
 *   vi.mock('solid-js/store', () => solidStoreMock);
 */
export const solidStoreMock = {
  createStore: <T extends object>(init: T): [T, (key: string, value: unknown) => void] => {
    const store = { ...init } as Record<string, unknown>;
    const setStore = (key: string, value: unknown) => {
      store[key] = value;
    };
    return [store as T, setStore as unknown as (key: string, value: unknown) => void];
  },
};
