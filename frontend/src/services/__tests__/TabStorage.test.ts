import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TabPanelState } from '../TabStorage';

// Mock lane-api
const mockGetLane = vi.fn();
const mockUpdateLaneConfig = vi.fn();
vi.mock('../../lib/lane-api', () => ({
  getLane: (...args: unknown[]) => mockGetLane(...args),
  updateLaneConfig: (...args: unknown[]) => mockUpdateLaneConfig(...args),
}));

// Mock storage (now async)
const mockGetPanelState = vi.fn();
const mockSetPanelState = vi.fn();
vi.mock('../../lib/storage', () => ({
  getPanelState: (...args: unknown[]) => mockGetPanelState(...args),
  setPanelState: (...args: unknown[]) => mockSetPanelState(...args),
}));

let loadTabPanelState: typeof import('../TabStorage')['loadTabPanelState'];
let saveTabPanelState: typeof import('../TabStorage')['saveTabPanelState'];
let atomicUpdate: typeof import('../TabStorage')['atomicUpdate'];

beforeEach(async () => {
  mockGetLane.mockReset();
  mockUpdateLaneConfig.mockReset();
  mockGetPanelState.mockReset();
  mockSetPanelState.mockReset();

  mockSetPanelState.mockResolvedValue(undefined);

  vi.resetModules();
  const mod = await import('../TabStorage');
  loadTabPanelState = mod.loadTabPanelState;
  saveTabPanelState = mod.saveTabPanelState;
  atomicUpdate = mod.atomicUpdate;
});

const sampleTabs = [
  { id: 'tab-1', type: 'terminal' as const, title: 'Terminal', sortOrder: 0, createdAt: 1000 },
  { id: 'tab-2', type: 'editor' as const, title: 'Editor', sortOrder: 1, createdAt: 1001 },
];

describe('TabStorage', () => {
  describe('loadTabPanelState', () => {
    it('merges lane config with panel state', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { tabs: sampleTabs, activeTabId: 'tab-1' },
      });
      mockGetPanelState.mockResolvedValue({ collapsed: false, height: 500 });

      const state = await loadTabPanelState('lane-1');

      expect(state).toEqual({
        laneId: 'lane-1',
        collapsed: false,
        height: 500,
        tabs: sampleTabs,
        activeTabId: 'tab-1',
      });
      expect(mockGetLane).toHaveBeenCalledWith('lane-1');
      expect(mockGetPanelState).toHaveBeenCalledWith('lane-1');
    });

    it('returns empty tabs when config has no tabs', async () => {
      mockGetLane.mockResolvedValue({ id: 'lane-1', config: {} });
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });

      const state = await loadTabPanelState('lane-1');

      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeUndefined();
    });

    it('returns empty tabs when config is undefined', async () => {
      mockGetLane.mockResolvedValue({ id: 'lane-1', config: undefined });
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });

      const state = await loadTabPanelState('lane-1');

      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeUndefined();
    });

    it('returns safe defaults on error', async () => {
      mockGetLane.mockRejectedValue(new Error('Lane not found'));

      const state = await loadTabPanelState('nonexistent');

      expect(state).toEqual({
        laneId: 'nonexistent',
        collapsed: true,
        height: 400,
        tabs: [],
        activeTabId: undefined,
      });
    });
  });

  describe('saveTabPanelState', () => {
    it('saves collapsed/height to store', async () => {
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });

      await saveTabPanelState('lane-1', { collapsed: false, height: 600 });

      expect(mockSetPanelState).toHaveBeenCalledWith('lane-1', {
        collapsed: false,
        height: 600,
      });
      expect(mockUpdateLaneConfig).not.toHaveBeenCalled();
    });

    it('saves tabs/activeTabId via lane config', async () => {
      mockGetLane.mockResolvedValue({ id: 'lane-1', config: { env: [] } });
      mockUpdateLaneConfig.mockResolvedValue(undefined);

      await saveTabPanelState('lane-1', { tabs: sampleTabs, activeTabId: 'tab-2' });

      expect(mockUpdateLaneConfig).toHaveBeenCalledWith('lane-1', {
        env: [],
        tabs: sampleTabs,
        activeTabId: 'tab-2',
      });
      expect(mockSetPanelState).not.toHaveBeenCalled();
    });

    it('merges partial collapsed with existing panel state', async () => {
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });

      await saveTabPanelState('lane-1', { collapsed: false });

      expect(mockSetPanelState).toHaveBeenCalledWith('lane-1', {
        collapsed: false,
        height: 400,
      });
    });

    it('merges partial height with existing panel state', async () => {
      mockGetPanelState.mockResolvedValue({ collapsed: false, height: 400 });

      await saveTabPanelState('lane-1', { height: 700 });

      expect(mockSetPanelState).toHaveBeenCalledWith('lane-1', {
        collapsed: false,
        height: 700,
      });
    });

    it('preserves existing lane config when saving tabs', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { env: [['KEY', 'VAL']], agentOverride: { agentType: 'claude' } },
      });
      mockUpdateLaneConfig.mockResolvedValue(undefined);

      await saveTabPanelState('lane-1', { tabs: sampleTabs });

      expect(mockUpdateLaneConfig).toHaveBeenCalledWith('lane-1', {
        env: [['KEY', 'VAL']],
        agentOverride: { agentType: 'claude' },
        tabs: sampleTabs,
        activeTabId: undefined,
      });
    });

    it('does not throw on error', async () => {
      mockGetLane.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await saveTabPanelState('lane-1', { tabs: [] });
    });

    it('does nothing when no relevant fields are provided', async () => {
      await saveTabPanelState('lane-1', {});

      expect(mockSetPanelState).not.toHaveBeenCalled();
      expect(mockUpdateLaneConfig).not.toHaveBeenCalled();
      expect(mockGetLane).not.toHaveBeenCalled();
    });
  });

  describe('atomicUpdate', () => {
    it('detects and saves changed fields only', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { tabs: sampleTabs, activeTabId: 'tab-1' },
      });
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });
      mockUpdateLaneConfig.mockResolvedValue(undefined);

      await atomicUpdate('lane-1', (prev) => ({
        ...prev,
        collapsed: false, // changed
      }));

      expect(mockSetPanelState).toHaveBeenCalledWith('lane-1', {
        collapsed: false,
        height: 400,
      });
      // tabs/activeTabId didn't change, so updateLaneConfig should NOT be called
      expect(mockUpdateLaneConfig).not.toHaveBeenCalled();
    });

    it('detects tab changes', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { tabs: [sampleTabs[0]], activeTabId: 'tab-1' },
      });
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });
      mockUpdateLaneConfig.mockResolvedValue(undefined);

      const newTabs = [...sampleTabs]; // added tab-2
      await atomicUpdate('lane-1', (prev) => ({
        ...prev,
        tabs: newTabs,
        activeTabId: 'tab-2',
      }));

      expect(mockUpdateLaneConfig).toHaveBeenCalled();
    });

    it('skips save when nothing changed', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { tabs: sampleTabs, activeTabId: 'tab-1' },
      });
      mockGetPanelState.mockResolvedValue({ collapsed: true, height: 400 });

      await atomicUpdate('lane-1', (prev) => ({ ...prev }));

      expect(mockSetPanelState).not.toHaveBeenCalled();
      expect(mockUpdateLaneConfig).not.toHaveBeenCalled();
    });

    it('detects height change', async () => {
      mockGetLane.mockResolvedValue({
        id: 'lane-1',
        config: { tabs: [], activeTabId: undefined },
      });
      mockGetPanelState.mockResolvedValue({ collapsed: false, height: 400 });

      await atomicUpdate('lane-1', (prev) => ({
        ...prev,
        height: 600,
      }));

      expect(mockSetPanelState).toHaveBeenCalledWith('lane-1', {
        collapsed: false,
        height: 600,
      });
    });
  });
});
