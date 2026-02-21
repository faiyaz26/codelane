import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock store
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
vi.mock('../store', () => ({
  getStore: vi.fn(async () => ({
    get: (...args: unknown[]) => mockStoreGet(...args),
    set: (...args: unknown[]) => mockStoreSet(...args),
    save: (...args: unknown[]) => mockStoreSave(...args),
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

// Mock git-api
const mockIsGitRepo = vi.fn();
const mockBranchExists = vi.fn();
const mockCreateBranch = vi.fn();
const mockCreateWorktree = vi.fn();
const mockRemoveWorktree = vi.fn();
const mockGetDefaultBranch = vi.fn();
vi.mock('../git-api', () => ({
  isGitRepo: (...args: unknown[]) => mockIsGitRepo(...args),
  branchExists: (...args: unknown[]) => mockBranchExists(...args),
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
  createWorktree: (...args: unknown[]) => mockCreateWorktree(...args),
  removeWorktree: (...args: unknown[]) => mockRemoveWorktree(...args),
  getDefaultBranch: (...args: unknown[]) => mockGetDefaultBranch(...args),
}));

let createLane: typeof import('../lane-api')['createLane'];
let listLanes: typeof import('../lane-api')['listLanes'];
let getLane: typeof import('../lane-api')['getLane'];
let updateLane: typeof import('../lane-api')['updateLane'];
let deleteLane: typeof import('../lane-api')['deleteLane'];
let touchLane: typeof import('../lane-api')['touchLane'];
let updateLaneOrder: typeof import('../lane-api')['updateLaneOrder'];
let updateLaneConfig: typeof import('../lane-api')['updateLaneConfig'];

beforeEach(async () => {
  mockStoreGet.mockReset();
  mockStoreSet.mockReset();
  mockStoreSave.mockReset();
  mockIsGitRepo.mockReset();
  mockBranchExists.mockReset();
  mockCreateBranch.mockReset();
  mockCreateWorktree.mockReset();
  mockRemoveWorktree.mockReset();
  mockGetDefaultBranch.mockReset();

  // Default: empty lanes
  mockStoreGet.mockResolvedValue([]);
  mockStoreSet.mockResolvedValue(undefined);
  mockStoreSave.mockResolvedValue(undefined);

  vi.resetModules();
  const mod = await import('../lane-api');
  createLane = mod.createLane;
  listLanes = mod.listLanes;
  getLane = mod.getLane;
  updateLane = mod.updateLane;
  deleteLane = mod.deleteLane;
  touchLane = mod.touchLane;
  updateLaneOrder = mod.updateLaneOrder;
  updateLaneConfig = mod.updateLaneConfig;
});

describe('lane-api', () => {
  describe('createLane', () => {
    it('creates a lane with basic params', async () => {
      const lane = await createLane({ name: 'My Lane', workingDir: '/path/to/project' });

      expect(lane.id).toBe('mock-uuid-1234');
      expect(lane.name).toBe('My Lane');
      expect(lane.workingDir).toBe('/path/to/project');
      expect(lane.createdAt).toBeGreaterThan(0);
      expect(lane.config).toEqual({ env: [], lspServers: [] });
      expect(mockStoreSet).toHaveBeenCalledWith('lanes', expect.any(Array));
      expect(mockStoreSave).toHaveBeenCalled();
    });

    it('throws on empty working directory', async () => {
      await expect(createLane({ name: 'Test', workingDir: '' })).rejects.toThrow('Working directory is required');
    });

    it('throws on whitespace-only working directory', async () => {
      await expect(createLane({ name: 'Test', workingDir: '   ' })).rejects.toThrow('Working directory is required');
    });

    it('handles branch creation in git repo', async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockBranchExists.mockResolvedValue(false);
      mockGetDefaultBranch.mockResolvedValue('main');
      mockCreateBranch.mockResolvedValue(undefined);
      mockCreateWorktree.mockResolvedValue('/worktree/path');

      const lane = await createLane({
        name: 'Feature Lane',
        workingDir: '/repo',
        branch: 'feature/new',
      });

      expect(lane.branch).toBe('feature/new');
      expect(lane.worktreePath).toBe('/worktree/path');
      expect(mockCreateBranch).toHaveBeenCalledWith('/repo', 'feature/new', 'main');
      expect(mockCreateWorktree).toHaveBeenCalledWith('/repo', 'feature/new');
    });

    it('skips branch creation for existing branch', async () => {
      mockIsGitRepo.mockResolvedValue(true);
      mockBranchExists.mockResolvedValue(true);
      mockCreateWorktree.mockResolvedValue('/worktree/path');

      await createLane({
        name: 'Lane',
        workingDir: '/repo',
        branch: 'existing-branch',
      });

      expect(mockCreateBranch).not.toHaveBeenCalled();
      expect(mockCreateWorktree).toHaveBeenCalled();
    });

    it('ignores branch for non-git directory', async () => {
      mockIsGitRepo.mockResolvedValue(false);

      const lane = await createLane({
        name: 'Lane',
        workingDir: '/not-a-repo',
        branch: 'feature',
      });

      expect(lane.branch).toBeUndefined();
      expect(lane.worktreePath).toBeUndefined();
    });
  });

  describe('listLanes', () => {
    it('returns parsed lanes', async () => {
      mockStoreGet.mockResolvedValue([
        {
          id: 'lane-1',
          name: 'First',
          workingDir: '/path/1',
          worktreePath: null,
          branch: null,
          config: { env: [], lspServers: [] },
          createdAt: 1000,
          updatedAt: 2000,
        },
        {
          id: 'lane-2',
          name: 'Second',
          workingDir: '/path/2',
          worktreePath: '/worktree',
          branch: 'feature',
          config: { agentOverride: { agentType: 'claude' } },
          createdAt: 1500,
          updatedAt: 2500,
        },
      ]);

      const lanes = await listLanes();

      expect(lanes).toHaveLength(2);
      expect(lanes[0].name).toBe('First');
      expect(lanes[0].worktreePath).toBeUndefined(); // null → undefined
      expect(lanes[1].branch).toBe('feature');
      expect(lanes[1].config?.agentOverride?.agentType).toBe('claude');
    });

    it('returns empty array when no lanes exist', async () => {
      mockStoreGet.mockResolvedValue([]);

      const lanes = await listLanes();

      expect(lanes).toEqual([]);
    });

    it('handles missing config gracefully', async () => {
      mockStoreGet.mockResolvedValue([
        {
          id: 'lane-1',
          name: 'Test',
          workingDir: '/p',
          worktreePath: null,
          branch: null,
          config: undefined,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ]);

      const lanes = await listLanes();

      expect(lanes[0].config?.env).toEqual([]);
    });
  });

  describe('getLane', () => {
    it('returns lane by ID', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        name: 'Test Lane',
        workingDir: '/path',
        worktreePath: null,
        branch: null,
        config: { env: [] },
        createdAt: 1000,
        updatedAt: 2000,
      }]);

      const lane = await getLane('lane-1');

      expect(lane.id).toBe('lane-1');
      expect(lane.name).toBe('Test Lane');
    });

    it('throws when lane not found', async () => {
      mockStoreGet.mockResolvedValue([]);

      await expect(getLane('nonexistent')).rejects.toThrow('Lane not found: nonexistent');
    });
  });

  describe('updateLane', () => {
    it('updates name and bumps updatedAt', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        name: 'Old Name',
        workingDir: '/path',
        config: {},
        createdAt: 1000,
        updatedAt: 2000,
      }]);

      const lane = await updateLane({ laneId: 'lane-1', name: 'New Name' });

      expect(lane.name).toBe('New Name');
      expect(mockStoreSet).toHaveBeenCalledWith('lanes', expect.arrayContaining([
        expect.objectContaining({ id: 'lane-1', name: 'New Name' }),
      ]));
    });

    it('updates workingDir', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        name: 'Test',
        workingDir: '/old/path',
        config: {},
        createdAt: 1000,
        updatedAt: 2000,
      }]);

      await updateLane({ laneId: 'lane-1', workingDir: '/new/path' });

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', expect.arrayContaining([
        expect.objectContaining({ workingDir: '/new/path' }),
      ]));
    });
  });

  describe('deleteLane', () => {
    it('deletes a lane without worktree', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        workingDir: '/path',
        worktreePath: null,
        branch: null,
      }]);

      await deleteLane('lane-1');

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', []);
      expect(mockRemoveWorktree).not.toHaveBeenCalled();
    });

    it('removes worktree before deleting lane', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        workingDir: '/repo',
        worktreePath: '/worktree/path',
        branch: 'feature',
      }]);
      mockRemoveWorktree.mockResolvedValue(undefined);

      await deleteLane('lane-1');

      expect(mockRemoveWorktree).toHaveBeenCalledWith('/repo', '/worktree/path');
      expect(mockStoreSet).toHaveBeenCalledWith('lanes', []);
    });

    it('continues deletion even if worktree removal fails', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        workingDir: '/repo',
        worktreePath: '/worktree/path',
        branch: 'feature',
      }]);
      mockRemoveWorktree.mockRejectedValue(new Error('Failed'));

      // Should not throw
      await deleteLane('lane-1');

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', []);
    });
  });

  describe('touchLane', () => {
    it('updates lastAccessed timestamp', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        name: 'Test',
        workingDir: '/path',
      }]);

      await touchLane('lane-1');

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', expect.arrayContaining([
        expect.objectContaining({ id: 'lane-1', lastAccessed: expect.any(Number) }),
      ]));
      expect(mockStoreSave).toHaveBeenCalled();
    });
  });

  describe('updateLaneOrder', () => {
    it('reorders lanes based on given IDs', async () => {
      mockStoreGet.mockResolvedValue([
        { id: 'lane-a', name: 'A' },
        { id: 'lane-b', name: 'B' },
        { id: 'lane-c', name: 'C' },
      ]);

      await updateLaneOrder(['lane-c', 'lane-a', 'lane-b']);

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', [
        expect.objectContaining({ id: 'lane-c' }),
        expect.objectContaining({ id: 'lane-a' }),
        expect.objectContaining({ id: 'lane-b' }),
      ]);
    });
  });

  describe('updateLaneConfig', () => {
    it('updates config and saves', async () => {
      mockStoreGet.mockResolvedValue([{
        id: 'lane-1',
        name: 'Test',
        workingDir: '/p',
        config: { env: [] },
        updatedAt: 1000,
      }]);

      const config = { env: [['KEY', 'VALUE'] as [string, string]], lspServers: ['ts'] };
      await updateLaneConfig('lane-1', config);

      expect(mockStoreSet).toHaveBeenCalledWith('lanes', expect.arrayContaining([
        expect.objectContaining({ id: 'lane-1', config }),
      ]));
      expect(mockStoreSave).toHaveBeenCalled();
    });
  });
});
