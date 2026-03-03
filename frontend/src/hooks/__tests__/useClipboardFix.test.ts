import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

// Mock Tauri clipboard manager
const mockReadText = vi.fn();
const mockWriteText = vi.fn();

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: () => mockReadText(),
  writeText: (text: string) => mockWriteText(text),
}));

// Mock Tauri core (for any other potential invokes)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Must import after mocks
let useClipboardFix: typeof import('../useClipboardFix')['useClipboardFix'];

const listeners: { type: string; listener: any; options?: any }[] = [];
const originalAddEventListener = document.addEventListener;
const originalRemoveEventListener = document.removeEventListener;

beforeEach(async () => {
  mockReadText.mockReset();
  mockWriteText.mockReset();
  
  // Spy on addEventListener to track listeners added during test
  document.addEventListener = vi.fn((type, listener, options) => {
    listeners.push({ type, listener, options });
    originalAddEventListener.call(document, type, listener, options);
  });

  vi.resetModules();
  const mod = await import('../useClipboardFix');
  useClipboardFix = mod.useClipboardFix;
  
  // Reset body
  document.body.innerHTML = '';
});

afterEach(() => {
  // Remove all tracked listeners
  listeners.forEach(({ type, listener, options }) => {
    originalRemoveEventListener.call(document, type, listener, options);
  });
  listeners.length = 0;
  
  // Restore original methods
  document.addEventListener = originalAddEventListener;
  document.removeEventListener = originalRemoveEventListener;
});

describe('useClipboardFix', () => {
  it('should NOT call readText on Cmd+V keydown (to avoid double paste)', async () => {
    mockReadText.mockResolvedValue('pasted content');

    await createRoot(async (dispose) => {
      useClipboardFix();
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Simulate Cmd+V keydown
      const event = new KeyboardEvent('keydown', {
        key: 'v',
        metaKey: true,
        bubbles: true,
      });
      input.dispatchEvent(event);

      // Should NOT have called readText from keydown
      expect(mockReadText).not.toHaveBeenCalled();
      
      dispose();
    });
  });

  it('should call readText and inject value on native paste event', async () => {
    mockReadText.mockResolvedValue('pasted content');

    await createRoot(async (dispose) => {
      useClipboardFix();
      
      const input = document.createElement('input');
      input.value = 'original ';
      document.body.appendChild(input);
      input.focus();
      input.setSelectionRange(9, 9); // At the end

      // Simulate native paste event
      const event = new Event('paste', {
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      // Need to wait for async clipboard read
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should HAVE called readText exactly once from paste event
      expect(mockReadText).toHaveBeenCalledTimes(1);
      expect(input.value).toBe('original pasted content');
      
      dispose();
    });
  });

  it('should handle Cmd+C for copying text', async () => {
    await createRoot(async (dispose) => {
      useClipboardFix();
      
      const div = document.createElement('div');
      div.innerText = 'selected text';
      document.body.appendChild(div);
      
      // Mock selection
      const oldGetSelection = window.getSelection;
      window.getSelection = vi.fn().mockReturnValue({
        rangeCount: 1,
        toString: () => 'selected text',
      });

      // Simulate Cmd+C keydown
      const event = new KeyboardEvent('keydown', {
        key: 'c',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);

      expect(mockWriteText).toHaveBeenCalledWith('selected text');
      expect(event.defaultPrevented).toBe(true);
      
      window.getSelection = oldGetSelection;
      dispose();
    });
  });

  it('should NOT intercept clipboard events if target is inside an xterm terminal', async () => {
    mockReadText.mockResolvedValue('terminal paste');

    await createRoot(async (dispose) => {
      useClipboardFix();
      
      const terminalContainer = document.createElement('div');
      terminalContainer.className = 'xterm';
      const terminalContent = document.createElement('div');
      terminalContainer.appendChild(terminalContent);
      document.body.appendChild(terminalContainer);
      terminalContent.focus();

      // Simulate native paste event
      const event = new Event('paste', {
        bubbles: true,
        cancelable: true,
      });
      const prevented = !terminalContent.dispatchEvent(event);

      // Should NOT have called our custom logic (should let xterm handle it)
      expect(mockReadText).not.toHaveBeenCalled();
      expect(prevented).toBe(false); // event should not be prevented by our hook
      
      dispose();
    });
  });
});
