import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

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

// Mock git-api
const mockIsGitRepo = vi.fn();
const mockBranchExists = vi.fn();
const mockCreateBranch = vi.fn();
const mockCreateWorktree = vi.fn();
const mockRemoveWorktree = vi.fn();
const mockGetDefaultBranch = vi.fn();
const mockFetchBranch = vi.fn();
const mockFetchPrBranch = vi.fn();
const mockCloneRepo = vi.fn();
const mockGetRemoteUrl = vi.fn();
vi.mock('../git-api', () => ({
  isGitRepo: (...args: unknown[]) => mockIsGitRepo(...args),
  branchExists: (...args: unknown[]) => mockBranchExists(...args),
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
  createWorktree: (...args: unknown[]) => mockCreateWorktree(...args),
  removeWorktree: (...args: unknown[]) => mockRemoveWorktree(...args),
  getDefaultBranch: (...args: unknown[]) => mockGetDefaultBranch(...args),
  fetchBranch: (...args: unknown[]) => mockFetchBranch(...args),
  fetchPrBranch: (...args: unknown[]) => mockFetchPrBranch(...args),
  cloneRepo: (...args: unknown[]) => mockCloneRepo(...args),
  getRemoteUrl: (...args: unknown[]) => mockGetRemoteUrl(...args),
}));

let createLane: typeof import('../lane-api')['createLane'];
let listLanes: typeof import('../lane-api')['listLanes'];
let getLane: typeof import('../lane-api')['getLane'];
let updateLane: typeof import('../lane-api')['updateLane'];
let deleteLane: typeof import('../lane-api')['deleteLane'];
let touchLane: typeof import('../lane-api')['touchLane'];
let updateLaneOrder: typeof import('../lane-api')['updateLaneOrder'];
let updateLaneConfig: typeof import('../lane-api')['updateLaneConfig'];
let convertToFeatureLane: typeof import('../lane-api')['convertToFeatureLane'];
let migrateLanesToBackend: typeof import('../lane-api')['migrateLanesToBackend'];

beforeEach(async () => {
  mockInvoke.mockReset();
  mockStoreGet.mockReset();
  mockStoreSet.mockReset();
  mockStoreDelete.mockReset();
  mockStoreSave.mockReset();
  mockIsGitRepo.mockReset();
  mockBranchExists.mockReset();
  mockCreateBranch.mockReset();
  mockCreateWorktree.mockReset();
  mockRemoveWorktree.mockReset();
  mockRemoveWorktree.mockResolvedValue(undefined);
  mockGetDefaultBranch.mockReset();
  mockFetchBranch.mockReset();
  mockFetchPrBranch.mockReset();
  mockCloneRepo.mockReset();
  mockGetRemoteUrl.mockReset();
  mockFetchBranch.mockResolvedValue(undefined);
  mockFetchPrBranch.mockResolvedValue(undefined);
  mockCloneRepo.mockResolvedValue(undefined);
  mockGetRemoteUrl.mockResolvedValue('https://github.com/owner/repo.git');

  // Default mock returns
  mockStoreGet.mockResolvedValue(null);
  mockInvoke.mockResolvedValue([]);

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
  convertToFeatureLane = mod.convertToFeatureLane;
  migrateLanesToBackend = mod.migrateLanesToBackend;
});

describe('lane-api', () => {
  describe('migrateLanesToBackend', () => {
    it('skips migration if already done', async () => {
      mockStoreGet.mockResolvedValue(true); // migration_done = true
      
      await migrateLanesToBackend();
      
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('migrates lanes and cleans up store if not done', async () => {
      const legacyLanes = [{ id: 'lane-1', name: 'Legacy' }];
      mockStoreGet.mockImplementation((key) => {
        if (key === 'lanes_migration_done') return false;
        if (key === 'lanes') return legacyLanes;
        return null;
      });
      
      await migrateLanesToBackend();
      
      expect(mockInvoke).toHaveBeenCalledWith('lane_batch_create', { lanesToCreate: legacyLanes });
      expect(mockStoreDelete).toHaveBeenCalledWith('lanes');
      expect(mockStoreSet).toHaveBeenCalledWith('lanes_migration_done', true);
      expect(mockStoreSave).toHaveBeenCalled();
    });

    it('handles empty legacy lanes gracefully', async () => {
      mockStoreGet.mockResolvedValue(null);
      
      await migrateLanesToBackend();
      
      expect(mockInvoke).not.toHaveBeenCalledWith('lane_batch_create', expect.anything());
      expect(mockStoreSet).toHaveBeenCalledWith('lanes_migration_done', true);
    });
  });

  describe('createLane', () => {
    it('calls lane_create with basic params', async () => {
      const mockLane = { id: 'new-id', name: 'My Lane' };
      mockInvoke.mockResolvedValue(mockLane);

      const result = await createLane({ name: 'My Lane', workingDir: '/path/to/project' });

      expect(mockInvoke).toHaveBeenCalledWith('lane_create', {
        name: 'My Lane',
        workingDir: '/path/to/project',
        worktreePath: null,
        branch: null,
        laneType: 'feature',
        prMetadata: null,
      });
      expect(result).toEqual(mockLane);
    });

    it('throws on empty working directory', async () => {
      await expect(createLane({ name: 'Test', workingDir: '' })).rejects.toThrow('Working directory is required');
    });

    describe('PR review lane autonomous cloning', () => {
      const prMetadata = {
        number: 123,
        title: 'Fix bug',
        author: 'faiyaz',
        baseBranch: 'main',
        headBranch: 'patch-1',
        headSha: 'abc',
        prUrl: 'https://github.com/owner/repo/pull/123',
        repoUrl: 'https://github.com/owner/repo.git',
        repoName: 'owner/repo',
        body: 'fixes #1',
        state: 'open',
        filesChanged: 1,
        additions: 1,
        deletions: 1,
      };

      it('clones the repo if workingDir is not a git repo', async () => {
        mockIsGitRepo.mockResolvedValue(false);
        mockInvoke.mockResolvedValue({ id: 'id' });

        await createLane({
          name: 'PR Review',
          workingDir: '/projects',
          laneType: 'pr_review',
          prMetadata,
        });

        expect(mockCloneRepo).toHaveBeenCalledWith(prMetadata.repoUrl, '/projects/repo');
        expect(mockInvoke).toHaveBeenCalledWith('lane_create', expect.objectContaining({
          workingDir: '/projects/repo',
          laneType: 'pr_review',
        }));
      });
    });
  });

  describe('listLanes', () => {
    it('triggers migration and calls lane_list', async () => {
      const mockLanes = [{ id: '1' }, { id: '2' }];
      mockInvoke.mockResolvedValue(mockLanes);
      mockStoreGet.mockResolvedValue(true); // migration done

      const result = await listLanes();

      expect(mockInvoke).toHaveBeenCalledWith('lane_list');
      expect(result).toEqual(mockLanes);
    });
  });

  describe('getLane', () => {
    it('calls lane_get', async () => {
      const mockLane = { id: 'lane-1' };
      mockInvoke.mockResolvedValue(mockLane);

      const result = await getLane('lane-1');

      expect(mockInvoke).toHaveBeenCalledWith('lane_get', { laneId: 'lane-1' });
      expect(result).toEqual(mockLane);
    });
  });

  describe('updateLane', () => {
    it('calls lane_update', async () => {
      await updateLane({ laneId: 'lane-1', name: 'New Name' });

      expect(mockInvoke).toHaveBeenCalledWith('lane_update', {
        laneId: 'lane-1',
        name: 'New Name',
        workingDir: null,
        lastAccessed: null,
        sortOrder: null,
        laneType: null,
      });
    });
  });

  describe('deleteLane', () => {
    it('calls lane_delete and handles worktree cleanup', async () => {
      mockInvoke.mockImplementation((cmd, args) => {
        if (cmd === 'lane_get') return Promise.resolve({ 
          id: 'lane-1', 
          workingDir: '/repo', 
          worktreePath: '/wt', 
          branch: 'b' 
        });
        return Promise.resolve();
      });

      await deleteLane('lane-1');

      expect(mockInvoke).toHaveBeenCalledWith('lane_delete', { laneId: 'lane-1' });
      expect(mockRemoveWorktree).toHaveBeenCalledWith('/repo', '/wt');
    });
  });

  describe('touchLane', () => {
    it('calls lane_touch', async () => {
      await touchLane('lane-1');
      expect(mockInvoke).toHaveBeenCalledWith('lane_touch', { laneId: 'lane-1' });
    });
  });

  describe('updateLaneOrder', () => {
    it('calls lane_update for each lane with new sort order', async () => {
      await updateLaneOrder(['id-1', 'id-2']);

      expect(mockInvoke).toHaveBeenCalledTimes(2);
      expect(mockInvoke).toHaveBeenCalledWith('lane_update', expect.objectContaining({
        laneId: 'id-1',
        sortOrder: 0,
      }));
      expect(mockInvoke).toHaveBeenCalledWith('lane_update', expect.objectContaining({
        laneId: 'id-2',
        sortOrder: 1,
      }));
    });
  });

  describe('updateLaneConfig', () => {
    it('calls lane_update_config', async () => {
      const config = { env: [], lspServers: [] };
      await updateLaneConfig('lane-1', config);

      expect(mockInvoke).toHaveBeenCalledWith('lane_update_config', { laneId: 'lane-1', config });
    });
  });

  describe('convertToFeatureLane', () => {
    it('calls lane_update_type', async () => {
      await convertToFeatureLane('lane-1');

      expect(mockInvoke).toHaveBeenCalledWith('lane_update_type', {
        laneId: 'lane-1',
        laneType: 'feature',
        clearPrMetadata: true,
      });
    });
  });
});
