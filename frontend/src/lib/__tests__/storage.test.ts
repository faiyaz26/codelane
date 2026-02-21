import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock store
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreDelete = vi.fn();
const mockStoreSave = vi.fn();
vi.mock('../store', () => ({
  getStore: vi.fn(async () => ({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    delete: (...args: unknown[]) => mockStoreDelete(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
  })),
}));

let getActiveLaneId: typeof import('../storage')['getActiveLaneId'];
let setActiveLaneId: typeof import('../storage')['setActiveLaneId'];
let getPanelState: typeof import('../storage')['getPanelState'];
let setPanelState: typeof import('../storage')['setPanelState'];

beforeEach(async () => {
  mockStoreGet.mockReset();
  mockStoreSet.mockReset();
  mockStoreDelete.mockReset();
  mockStoreSave.mockReset();

  mockStoreSet.mockResolvedValue(undefined);
  mockStoreDelete.mockResolvedValue(undefined);
  mockStoreSave.mockResolvedValue(undefined);

  vi.resetModules();
  const mod = await import('../storage');
  getActiveLaneId = mod.getActiveLaneId;
  setActiveLaneId = mod.setActiveLaneId;
  getPanelState = mod.getPanelState;
  setPanelState = mod.setPanelState;
});

describe('storage', () => {
  describe('getActiveLaneId / setActiveLaneId', () => {
    it('returns null when no active lane set', async () => {
      mockStoreGet.mockResolvedValue(null);
      expect(await getActiveLaneId()).toBeNull();
    });

    it('persists and retrieves active lane ID', async () => {
      await setActiveLaneId('lane-123');
      expect(mockStoreSet).toHaveBeenCalledWith('active_lane_id', 'lane-123');
      expect(mockStoreSave).toHaveBeenCalled();
    });

    it('removes active lane when set to null', async () => {
      await setActiveLaneId(null);
      expect(mockStoreDelete).toHaveBeenCalledWith('active_lane_id');
      expect(mockStoreSave).toHaveBeenCalled();
    });

    it('retrieves stored active lane ID', async () => {
      mockStoreGet.mockResolvedValue('lane-456');
      expect(await getActiveLaneId()).toBe('lane-456');
    });
  });

  describe('getPanelState / setPanelState', () => {
    it('returns defaults when no state stored', async () => {
      mockStoreGet.mockResolvedValue(null);
      const state = await getPanelState('lane-1');
      expect(state).toEqual({ collapsed: true, height: 400 });
    });

    it('persists and retrieves panel state', async () => {
      await setPanelState('lane-1', { collapsed: false, height: 300 });
      expect(mockStoreSet).toHaveBeenCalledWith('panel_state:lane-1', { collapsed: false, height: 300 });
      expect(mockStoreSave).toHaveBeenCalled();
    });

    it('returns stored panel state', async () => {
      mockStoreGet.mockResolvedValue({ collapsed: false, height: 500 });
      const state = await getPanelState('lane-1');
      expect(state).toEqual({ collapsed: false, height: 500 });
    });

    it('uses correct key per lane', async () => {
      await setPanelState('lane-1', { collapsed: false, height: 300 });
      await setPanelState('lane-2', { collapsed: true, height: 500 });

      expect(mockStoreSet).toHaveBeenCalledWith('panel_state:lane-1', { collapsed: false, height: 300 });
      expect(mockStoreSet).toHaveBeenCalledWith('panel_state:lane-2', { collapsed: true, height: 500 });
    });

    it('returns defaults on error', async () => {
      mockStoreGet.mockRejectedValue(new Error('Store error'));
      const state = await getPanelState('lane-1');
      expect(state).toEqual({ collapsed: true, height: 400 });
    });
  });
});
