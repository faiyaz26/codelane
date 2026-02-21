import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ShortcutDefinition } from '../KeyboardShortcutManager';

// Mock window for addEventListener/removeEventListener
const listeners = new Map<string, Set<(e: KeyboardEvent) => void>>();
vi.stubGlobal('window', {
  addEventListener: vi.fn((event: string, handler: (e: KeyboardEvent) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  }),
  removeEventListener: vi.fn((event: string, handler: (e: KeyboardEvent) => void) => {
    listeners.get(event)?.delete(handler);
  }),
});

// Mock navigator for platform detection
vi.stubGlobal('navigator', { platform: 'MacIntel' });

function fireKeyDown(init: KeyboardEventInit & { key: string }): void {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true });
  // Override target if needed
  Object.defineProperty(event, 'target', {
    value: document.createElement('div'),
    writable: false,
  });
  const handlers = listeners.get('keydown');
  if (handlers) {
    for (const handler of handlers) {
      handler(event);
    }
  }
}

let keyboardShortcutManager: typeof import('../KeyboardShortcutManager')['keyboardShortcutManager'];
let CommonShortcuts: typeof import('../KeyboardShortcutManager')['CommonShortcuts'];

beforeEach(async () => {
  listeners.clear();
  vi.resetModules();
  const mod = await import('../KeyboardShortcutManager');
  keyboardShortcutManager = mod.keyboardShortcutManager;
  CommonShortcuts = mod.CommonShortcuts;
});

afterEach(() => {
  keyboardShortcutManager.destroy();
});

describe('KeyboardShortcutManager', () => {
  describe('register/unregister', () => {
    it('registers a shortcut and returns unregister function', () => {
      const handler = vi.fn();
      const unregister = keyboardShortcutManager.register({
        id: 'test',
        description: 'Test shortcut',
        key: 'a',
        handler,
      });

      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(1);
      expect(typeof unregister).toBe('function');
    });

    it('unregister removes the shortcut', () => {
      const unregister = keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler: vi.fn(),
      });

      unregister();
      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(0);
    });

    it('unregister by id works', () => {
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler: vi.fn(),
      });

      keyboardShortcutManager.unregister('test');
      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(0);
    });
  });

  describe('registerAll', () => {
    it('registers multiple shortcuts', () => {
      const unregister = keyboardShortcutManager.registerAll([
        { id: 'a', description: 'A', key: 'a', handler: vi.fn() },
        { id: 'b', description: 'B', key: 'b', handler: vi.fn() },
      ]);

      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(2);
      unregister();
      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(0);
    });
  });

  describe('registerGroup', () => {
    it('registers a group with prefixed ids', () => {
      const unregister = keyboardShortcutManager.registerGroup({
        id: 'editor',
        name: 'Editor',
        shortcuts: [
          { id: 'save', description: 'Save', key: 's', handler: vi.fn() },
          { id: 'undo', description: 'Undo', key: 'z', handler: vi.fn() },
        ],
      });

      const shortcuts = keyboardShortcutManager.getShortcuts();
      expect(shortcuts).toHaveLength(2);
      expect(shortcuts.map((s) => s.id)).toContain('editor.save');
      expect(shortcuts.map((s) => s.id)).toContain('editor.undo');

      unregister();
      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(0);
    });
  });

  describe('setEnabled', () => {
    it('disables a shortcut', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler,
      });

      keyboardShortcutManager.setEnabled('test', false);

      fireKeyDown({ key: 'a' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('re-enables a shortcut', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler,
      });

      keyboardShortcutManager.setEnabled('test', false);
      keyboardShortcutManager.setEnabled('test', true);

      fireKeyDown({ key: 'a' });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('key matching', () => {
    it('matches simple key', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'Escape',
        handler,
      });

      fireKeyDown({ key: 'Escape' });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('matches key with cmdOrCtrl (Mac uses metaKey)', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'f',
        modifiers: { cmdOrCtrl: true },
        handler,
      });

      // On Mac, cmdOrCtrl means metaKey
      fireKeyDown({ key: 'f', metaKey: true });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not match when modifier is missing', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'f',
        modifiers: { cmdOrCtrl: true },
        handler,
      });

      fireKeyDown({ key: 'f' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('matches key with shift modifier', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'p',
        modifiers: { cmdOrCtrl: true, shift: true },
        handler,
      });

      fireKeyDown({ key: 'p', metaKey: true, shiftKey: true });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not fire for wrong key', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler,
      });

      fireKeyDown({ key: 'b' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not match simple key when modifier is pressed', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler,
      });

      fireKeyDown({ key: 'a', metaKey: true });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('when condition', () => {
    it('fires when condition returns true', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'Escape',
        handler,
        when: () => true,
      });

      fireKeyDown({ key: 'Escape' });
      expect(handler).toHaveBeenCalledOnce();
    });

    it('does not fire when condition returns false', () => {
      const handler = vi.fn();
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'Escape',
        handler,
        when: () => false,
      });

      fireKeyDown({ key: 'Escape' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('formatShortcut', () => {
    it('formats cmdOrCtrl shortcut on Mac', () => {
      const shortcut: ShortcutDefinition = {
        id: 'test',
        description: 'Test',
        key: 'f',
        modifiers: { cmdOrCtrl: true },
        handler: vi.fn(),
      };

      const formatted = keyboardShortcutManager.formatShortcut(shortcut);
      // On Mac: ⌘F
      expect(formatted).toContain('⌘');
      expect(formatted).toContain('F');
    });

    it('formats shift shortcut on Mac', () => {
      const shortcut: ShortcutDefinition = {
        id: 'test',
        description: 'Test',
        key: 'p',
        modifiers: { cmdOrCtrl: true, shift: true },
        handler: vi.fn(),
      };

      const formatted = keyboardShortcutManager.formatShortcut(shortcut);
      expect(formatted).toContain('⌘');
      expect(formatted).toContain('⇧');
      expect(formatted).toContain('P');
    });
  });

  describe('CommonShortcuts', () => {
    it('FIND creates a shortcut with cmdOrCtrl+F', () => {
      const handler = vi.fn();
      const shortcut = CommonShortcuts.FIND(handler);
      expect(shortcut.key).toBe('f');
      expect(shortcut.modifiers?.cmdOrCtrl).toBe(true);
      expect(shortcut.scope).toBe('global');
    });

    it('ESCAPE creates a shortcut without preventDefault', () => {
      const shortcut = CommonShortcuts.ESCAPE(vi.fn());
      expect(shortcut.key).toBe('Escape');
      expect(shortcut.preventDefault).toBe(false);
    });

    it('SAVE creates a cmdOrCtrl+S shortcut', () => {
      const shortcut = CommonShortcuts.SAVE(vi.fn());
      expect(shortcut.key).toBe('s');
      expect(shortcut.modifiers?.cmdOrCtrl).toBe(true);
    });
  });

  describe('destroy', () => {
    it('clears all shortcuts and stops listening', () => {
      keyboardShortcutManager.register({
        id: 'test',
        description: 'Test',
        key: 'a',
        handler: vi.fn(),
      });

      keyboardShortcutManager.destroy();
      expect(keyboardShortcutManager.getShortcuts()).toHaveLength(0);
    });
  });
});
