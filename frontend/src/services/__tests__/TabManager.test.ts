import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TabStorage
const mockLoadTabPanelState = vi.fn();
const mockAtomicUpdate = vi.fn();
vi.mock('../TabStorage', () => ({
  loadTabPanelState: (...args: unknown[]) => mockLoadTabPanelState(...args),
  atomicUpdate: (...args: unknown[]) => mockAtomicUpdate(...args),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

let TabManagerClass: typeof import('../TabManager');
let tabManager: typeof import('../TabManager')['tabManager'];

beforeEach(async () => {
  mockLoadTabPanelState.mockReset();
  mockAtomicUpdate.mockReset();
  mockAtomicUpdate.mockResolvedValue(undefined);

  vi.resetModules();
  TabManagerClass = await import('../TabManager');
  tabManager = TabManagerClass.tabManager;
});

describe('TabManager', () => {
  describe('initializeLane', () => {
    it('loads tabs from storage', async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [{ id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 }],
        activeTabId: 'tab-1',
      });

      await tabManager.initializeLane('lane-1');

      expect(mockLoadTabPanelState).toHaveBeenCalledWith('lane-1');
      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()).toHaveLength(1);
      expect(tabs()[0].id).toBe('tab-1');
    });

    it('does not re-initialize an already initialized lane', async () => {
      mockLoadTabPanelState.mockResolvedValue({ tabs: [], activeTabId: undefined });

      await tabManager.initializeLane('lane-1');
      await tabManager.initializeLane('lane-1');

      expect(mockLoadTabPanelState).toHaveBeenCalledTimes(1);
    });

    it('initializes with empty tabs when storage is empty', async () => {
      mockLoadTabPanelState.mockResolvedValue({ tabs: [], activeTabId: undefined });

      await tabManager.initializeLane('lane-1');

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()).toHaveLength(0);
    });
  });

  describe('getTabs / getActiveTab', () => {
    it('throws for uninitialized lane', () => {
      expect(() => tabManager.getTabs('nonexistent')).toThrow('[TabManager] Lane not initialized');
    });

    it('getActiveTab throws for uninitialized lane', () => {
      expect(() => tabManager.getActiveTab('nonexistent')).toThrow('[TabManager] Lane not initialized');
    });

    it('returns active tab accessor', async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [{ id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 }],
        activeTabId: 'tab-1',
      });

      await tabManager.initializeLane('lane-1');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('tab-1');
    });
  });

  describe('createTab', () => {
    beforeEach(async () => {
      mockLoadTabPanelState.mockResolvedValue({ tabs: [], activeTabId: undefined });
      await tabManager.initializeLane('lane-1');
    });

    it('creates a tab with default values', async () => {
      const tab = await tabManager.createTab('lane-1');

      expect(tab.id).toBe('mock-uuid-1234');
      expect(tab.type).toBe('terminal');
      expect(tab.title).toBe('Terminal 1');
      expect(tab.sortOrder).toBe(0);
    });

    it('creates a tab with custom config', async () => {
      const tab = await tabManager.createTab('lane-1', {
        id: 'custom-id',
        type: 'extension',
        title: 'My Tab',
      });

      expect(tab.id).toBe('custom-id');
      expect(tab.type).toBe('extension');
      expect(tab.title).toBe('My Tab');
    });

    it('sets new tab as active', async () => {
      await tabManager.createTab('lane-1');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('mock-uuid-1234');
    });

    it('persists to storage', async () => {
      await tabManager.createTab('lane-1');

      expect(mockAtomicUpdate).toHaveBeenCalledWith('lane-1', expect.any(Function));
    });

    it('throws for uninitialized lane', async () => {
      await expect(tabManager.createTab('nonexistent')).rejects.toThrow(
        '[TabManager] Lane not initialized',
      );
    });
  });

  describe('closeTab', () => {
    beforeEach(async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [
          { id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 },
          { id: 'tab-2', type: 'terminal', title: 'Terminal 2', sortOrder: 1, createdAt: 2000 },
        ],
        activeTabId: 'tab-1',
      });
      await tabManager.initializeLane('lane-1');
    });

    it('removes tab from the list', async () => {
      await tabManager.closeTab('lane-1', 'tab-1');

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()).toHaveLength(1);
      expect(tabs()[0].id).toBe('tab-2');
    });

    it('switches to adjacent tab when closing active tab', async () => {
      await tabManager.closeTab('lane-1', 'tab-1');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('tab-2');
    });

    it('sets active to undefined when closing last tab', async () => {
      // Close both tabs
      await tabManager.closeTab('lane-1', 'tab-2');
      await tabManager.closeTab('lane-1', 'tab-1');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBeUndefined();
      expect(tabManager.getTabs('lane-1')()).toHaveLength(0);
    });

    it('does nothing for nonexistent tab', async () => {
      await tabManager.closeTab('lane-1', 'nonexistent');

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()).toHaveLength(2);
    });

    it('keeps active tab unchanged when closing non-active tab', async () => {
      await tabManager.closeTab('lane-1', 'tab-2');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('tab-1');
    });

    it('persists to storage', async () => {
      await tabManager.closeTab('lane-1', 'tab-1');

      expect(mockAtomicUpdate).toHaveBeenCalledWith('lane-1', expect.any(Function));
    });
  });

  describe('setActiveTab', () => {
    beforeEach(async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [
          { id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 },
          { id: 'tab-2', type: 'terminal', title: 'Terminal 2', sortOrder: 1, createdAt: 2000 },
        ],
        activeTabId: 'tab-1',
      });
      await tabManager.initializeLane('lane-1');
    });

    it('changes the active tab', async () => {
      await tabManager.setActiveTab('lane-1', 'tab-2');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('tab-2');
    });

    it('does nothing for nonexistent tab id', async () => {
      await tabManager.setActiveTab('lane-1', 'nonexistent');

      const activeTab = tabManager.getActiveTab('lane-1');
      expect(activeTab()).toBe('tab-1');
    });

    it('persists to storage', async () => {
      await tabManager.setActiveTab('lane-1', 'tab-2');

      expect(mockAtomicUpdate).toHaveBeenCalledWith('lane-1', expect.any(Function));
    });
  });

  describe('renameTab', () => {
    beforeEach(async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [{ id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 }],
        activeTabId: 'tab-1',
      });
      await tabManager.initializeLane('lane-1');
    });

    it('renames the tab', async () => {
      await tabManager.renameTab('lane-1', 'tab-1', 'New Name');

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()[0].title).toBe('New Name');
    });

    it('does nothing for nonexistent tab', async () => {
      await tabManager.renameTab('lane-1', 'nonexistent', 'New Name');

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()[0].title).toBe('Terminal 1');
    });
  });

  describe('reorderTabs', () => {
    beforeEach(async () => {
      mockLoadTabPanelState.mockResolvedValue({
        tabs: [
          { id: 'tab-1', type: 'terminal', title: 'Terminal 1', sortOrder: 0, createdAt: 1000 },
          { id: 'tab-2', type: 'terminal', title: 'Terminal 2', sortOrder: 1, createdAt: 2000 },
          { id: 'tab-3', type: 'terminal', title: 'Terminal 3', sortOrder: 2, createdAt: 3000 },
        ],
        activeTabId: 'tab-1',
      });
      await tabManager.initializeLane('lane-1');
    });

    it('reorders tabs with updated sortOrder', async () => {
      await tabManager.reorderTabs('lane-1', ['tab-3', 'tab-1', 'tab-2']);

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()[0].id).toBe('tab-3');
      expect(tabs()[0].sortOrder).toBe(0);
      expect(tabs()[1].id).toBe('tab-1');
      expect(tabs()[1].sortOrder).toBe(1);
      expect(tabs()[2].id).toBe('tab-2');
      expect(tabs()[2].sortOrder).toBe(2);
    });

    it('skips nonexistent tab ids', async () => {
      await tabManager.reorderTabs('lane-1', ['tab-2', 'nonexistent', 'tab-1']);

      const tabs = tabManager.getTabs('lane-1');
      expect(tabs()).toHaveLength(2);
    });
  });

  describe('disposeLane', () => {
    it('removes lane state', async () => {
      mockLoadTabPanelState.mockResolvedValue({ tabs: [], activeTabId: undefined });
      await tabManager.initializeLane('lane-1');

      tabManager.disposeLane('lane-1');

      expect(() => tabManager.getTabs('lane-1')).toThrow('[TabManager] Lane not initialized');
    });
  });
});
