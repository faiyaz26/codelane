/**
 * KeyboardShortcutManager - Centralized keyboard shortcut handling
 *
 * Features:
 * - Declarative shortcut definitions
 * - Support for modifier keys (cmd/ctrl, shift, alt)
 * - Scoped shortcuts (global vs component-level)
 * - Easy to add/remove shortcuts dynamically
 * - Platform-aware (cmd on Mac, ctrl on Windows/Linux)
 */

import { createSignal, onCleanup } from 'solid-js';

// Detect platform
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export interface ShortcutDefinition {
  /** Unique identifier for the shortcut */
  id: string;
  /** Human-readable description */
  description: string;
  /** Key to press (e.g., 'f', 'Enter', 'Escape') */
  key: string;
  /** Modifier keys */
  modifiers?: {
    /** cmd on Mac, ctrl on Windows/Linux */
    cmdOrCtrl?: boolean;
    /** shift key */
    shift?: boolean;
    /** alt/option key */
    alt?: boolean;
    /** ctrl key (always ctrl, even on Mac) */
    ctrl?: boolean;
    /** meta/cmd key (always meta, even on Windows) */
    meta?: boolean;
  };
  /** Callback when shortcut is triggered */
  handler: (e: KeyboardEvent) => void;
  /** Scope of the shortcut - global shortcuts always listen, component shortcuts only when focused */
  scope?: 'global' | 'component';
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Optional: condition function to check before triggering */
  when?: () => boolean;
}

export interface ShortcutGroup {
  /** Group identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Shortcuts in this group */
  shortcuts: ShortcutDefinition[];
}

class KeyboardShortcutManagerImpl {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private groups: Map<string, ShortcutGroup> = new Map();
  private isListening = false;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.startListening();
  }

  /**
   * Register a single shortcut
   */
  register(shortcut: ShortcutDefinition): () => void {
    const fullId = shortcut.id;
    this.shortcuts.set(fullId, {
      ...shortcut,
      enabled: shortcut.enabled ?? true,
      preventDefault: shortcut.preventDefault ?? true,
      scope: shortcut.scope ?? 'global',
    });

    // Return unregister function
    return () => this.unregister(fullId);
  }

  /**
   * Register multiple shortcuts at once
   */
  registerAll(shortcuts: ShortcutDefinition[]): () => void {
    const unregisters = shortcuts.map(s => this.register(s));
    return () => unregisters.forEach(fn => fn());
  }

  /**
   * Register a group of shortcuts
   */
  registerGroup(group: ShortcutGroup): () => void {
    this.groups.set(group.id, group);
    const unregisters = group.shortcuts.map(s =>
      this.register({ ...s, id: `${group.id}.${s.id}` })
    );
    return () => {
      unregisters.forEach(fn => fn());
      this.groups.delete(group.id);
    };
  }

  /**
   * Unregister a shortcut by ID
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Enable or disable a shortcut
   */
  setEnabled(id: string, enabled: boolean): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = enabled;
    }
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get human-readable shortcut string (e.g., "⌘F" or "Ctrl+F")
   */
  formatShortcut(shortcut: ShortcutDefinition): string {
    const parts: string[] = [];
    const mods = shortcut.modifiers || {};

    if (mods.cmdOrCtrl) {
      parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (mods.ctrl) {
      parts.push('Ctrl');
    }
    if (mods.meta) {
      parts.push(isMac ? '⌘' : 'Win');
    }
    if (mods.shift) {
      parts.push(isMac ? '⇧' : 'Shift');
    }
    if (mods.alt) {
      parts.push(isMac ? '⌥' : 'Alt');
    }

    // Format key name
    let keyName = shortcut.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName === 'ArrowUp') keyName = '↑';
    else if (keyName === 'ArrowDown') keyName = '↓';
    else if (keyName === 'ArrowLeft') keyName = '←';
    else if (keyName === 'ArrowRight') keyName = '→';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);

    return isMac ? parts.join('') : parts.join('+');
  }

  private startListening(): void {
    if (this.isListening) return;

    this.boundHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    window.addEventListener('keydown', this.boundHandler);
    this.isListening = true;
  }

  private stopListening(): void {
    if (!this.isListening || !this.boundHandler) return;

    window.removeEventListener('keydown', this.boundHandler);
    this.boundHandler = null;
    this.isListening = false;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Don't handle if typing in an input/textarea (unless shortcut explicitly allows it)
    const target = e.target as HTMLElement;
    const isInputElement = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue;
      if (shortcut.when && !shortcut.when()) continue;

      // Check if key matches
      if (!this.keyMatches(e, shortcut)) continue;

      // For global shortcuts in input fields, still trigger if explicitly cmdOrCtrl
      // (common pattern for things like Cmd+F, Cmd+S, etc.)
      if (isInputElement && shortcut.scope !== 'global') {
        // Only allow shortcuts with cmdOrCtrl in input fields
        if (!shortcut.modifiers?.cmdOrCtrl) continue;
      }

      // Trigger the shortcut
      if (shortcut.preventDefault) {
        e.preventDefault();
      }
      shortcut.handler(e);

      // Only handle the first matching shortcut
      return;
    }
  }

  private keyMatches(e: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
    const mods = shortcut.modifiers || {};

    // Check key (case-insensitive for letters)
    const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
                    e.code === shortcut.key ||
                    e.code === `Key${shortcut.key.toUpperCase()}`;
    if (!keyMatch) return false;

    // Check cmdOrCtrl (meta on Mac, ctrl on Windows)
    if (mods.cmdOrCtrl !== undefined) {
      const expectedMod = isMac ? e.metaKey : e.ctrlKey;
      if (mods.cmdOrCtrl !== expectedMod) return false;
    }

    // Check individual modifiers
    if (mods.ctrl !== undefined && mods.ctrl !== e.ctrlKey) return false;
    if (mods.meta !== undefined && mods.meta !== e.metaKey) return false;
    if (mods.shift !== undefined && mods.shift !== e.shiftKey) return false;
    if (mods.alt !== undefined && mods.alt !== e.altKey) return false;

    // If no modifiers specified but event has modifiers (except for special keys), don't match
    if (!mods.cmdOrCtrl && !mods.ctrl && !mods.meta && !mods.shift && !mods.alt) {
      // Allow Escape and Enter without modifiers even if modifiers are pressed
      const allowedWithoutMods = ['Escape', 'Enter', 'Tab'];
      if (!allowedWithoutMods.includes(shortcut.key)) {
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
      }
    }

    return true;
  }

  /**
   * Cleanup - call when app unmounts
   */
  destroy(): void {
    this.stopListening();
    this.shortcuts.clear();
    this.groups.clear();
  }
}

// Singleton instance
export const keyboardShortcutManager = new KeyboardShortcutManagerImpl();

// ============ PREDEFINED SHORTCUTS ============

/**
 * Common shortcut definitions that can be reused
 */
export const CommonShortcuts = {
  // Search
  FIND: (handler: () => void): ShortcutDefinition => ({
    id: 'find',
    description: 'Find in file',
    key: 'f',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  FIND_NEXT: (handler: () => void): ShortcutDefinition => ({
    id: 'findNext',
    description: 'Find next match',
    key: 'g',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  FIND_PREV: (handler: () => void): ShortcutDefinition => ({
    id: 'findPrev',
    description: 'Find previous match',
    key: 'g',
    modifiers: { cmdOrCtrl: true, shift: true },
    handler: () => handler(),
    scope: 'global',
  }),

  // Navigation
  GO_TO_LINE: (handler: () => void): ShortcutDefinition => ({
    id: 'goToLine',
    description: 'Go to line',
    key: 'g',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  // General
  ESCAPE: (handler: () => void): ShortcutDefinition => ({
    id: 'escape',
    description: 'Cancel / Close',
    key: 'Escape',
    handler: () => handler(),
    scope: 'global',
    preventDefault: false, // Let escape bubble for other handlers
  }),

  ENTER: (handler: () => void): ShortcutDefinition => ({
    id: 'enter',
    description: 'Confirm',
    key: 'Enter',
    handler: () => handler(),
    scope: 'component',
  }),

  SHIFT_ENTER: (handler: () => void): ShortcutDefinition => ({
    id: 'shiftEnter',
    description: 'Confirm (reverse)',
    key: 'Enter',
    modifiers: { shift: true },
    handler: () => handler(),
    scope: 'component',
  }),

  // File operations
  SAVE: (handler: () => void): ShortcutDefinition => ({
    id: 'save',
    description: 'Save file',
    key: 's',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  // Tab navigation
  NEXT_TAB: (handler: () => void): ShortcutDefinition => ({
    id: 'nextTab',
    description: 'Next tab',
    key: ']',
    modifiers: { cmdOrCtrl: true, shift: true },
    handler: () => handler(),
    scope: 'global',
  }),

  PREV_TAB: (handler: () => void): ShortcutDefinition => ({
    id: 'prevTab',
    description: 'Previous tab',
    key: '[',
    modifiers: { cmdOrCtrl: true, shift: true },
    handler: () => handler(),
    scope: 'global',
  }),

  CLOSE_TAB: (handler: () => void): ShortcutDefinition => ({
    id: 'closeTab',
    description: 'Close tab',
    key: 'w',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  // View
  TOGGLE_SIDEBAR: (handler: () => void): ShortcutDefinition => ({
    id: 'toggleSidebar',
    description: 'Toggle sidebar',
    key: 'b',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  TOGGLE_TERMINAL: (handler: () => void): ShortcutDefinition => ({
    id: 'toggleTerminal',
    description: 'Toggle terminal',
    key: '`',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),

  // Quick actions
  COMMAND_PALETTE: (handler: () => void): ShortcutDefinition => ({
    id: 'commandPalette',
    description: 'Command palette',
    key: 'p',
    modifiers: { cmdOrCtrl: true, shift: true },
    handler: () => handler(),
    scope: 'global',
  }),

  QUICK_OPEN: (handler: () => void): ShortcutDefinition => ({
    id: 'quickOpen',
    description: 'Quick open file',
    key: 'p',
    modifiers: { cmdOrCtrl: true },
    handler: () => handler(),
    scope: 'global',
  }),
};

// ============ HOOKS ============

/**
 * Hook to register shortcuts that are automatically cleaned up
 */
export function useShortcut(shortcut: ShortcutDefinition): void {
  const unregister = keyboardShortcutManager.register(shortcut);
  onCleanup(unregister);
}

/**
 * Hook to register multiple shortcuts
 */
export function useShortcuts(shortcuts: ShortcutDefinition[]): void {
  const unregister = keyboardShortcutManager.registerAll(shortcuts);
  onCleanup(unregister);
}

/**
 * Hook to register a shortcut group
 */
export function useShortcutGroup(group: ShortcutGroup): void {
  const unregister = keyboardShortcutManager.registerGroup(group);
  onCleanup(unregister);
}

/**
 * Hook to create a conditional shortcut that's only active based on a signal
 */
export function useConditionalShortcut(
  shortcut: Omit<ShortcutDefinition, 'when'>,
  isActive: () => boolean
): void {
  useShortcut({
    ...shortcut,
    when: isActive,
  });
}
