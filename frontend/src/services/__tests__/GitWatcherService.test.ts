import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock git-api
const mockIsGitRepo = vi.fn();
const mockGetGitStatus = vi.fn();
const mockGetChangesWithStats = vi.fn();
vi.mock('../../lib/git-api', () => ({
  isGitRepo: (...args: unknown[]) => mockIsGitRepo(...args),
  getGitStatus: (...args: unknown[]) => mockGetGitStatus(...args),
  getChangesWithStats: (...args: unknown[]) => mockGetChangesWithStats(...args),
}));

// Mock FileWatchService
const mockWatchDirectory = vi.fn();
vi.mock('../FileWatchService', () => ({
  fileWatchService: {
    watchDirectory: (...args: unknown[]) => mockWatchDirectory(...args),
  },
}));

// Mock ResourceManager
vi.mock('../ResourceManager', () => ({
  resourceManager: {
    isHighLoad: () => () => false,
  },
}));

let gitWatcherService: typeof import('../GitWatcherService')['gitWatcherService'];

beforeEach(async () => {
  vi.useFakeTimers();
  mockIsGitRepo.mockReset();
  mockGetGitStatus.mockReset();
  mockGetChangesWithStats.mockReset();
  mockWatchDirectory.mockReset();

  // Default: is a git repo with clean status
  mockIsGitRepo.mockResolvedValue(true);
  mockGetGitStatus.mockResolvedValue({
    branch: 'main',
    staged: [],
    unstaged: [],
    untracked: [],
  });
  mockGetChangesWithStats.mockResolvedValue([]);
  mockWatchDirectory.mockResolvedValue(vi.fn());

  vi.resetModules();
  const mod = await import('../GitWatcherService');
  gitWatcherService = mod.gitWatcherService;
});

afterEach(() => {
  gitWatcherService.dispose();
  vi.useRealTimers();
});

describe('GitWatcherService', () => {
  describe('subscribe', () => {
    it('returns state accessor and unsubscribe function', () => {
      const { state, unsubscribe } = gitWatcherService.subscribe('lane-1', '/path/to/repo');

      expect(typeof state).toBe('function');
      expect(typeof unsubscribe).toBe('function');
    });

    it('starts with loading state', () => {
      const { state } = gitWatcherService.subscribe('lane-1', '/path/to/repo');

      expect(state().isLoading).toBe(true);
      expect(state().status).toBeNull();
      expect(state().isRepo).toBeNull();
    });

    it('loads git status on subscribe', async () => {
      gitWatcherService.subscribe('lane-1', '/path/to/repo');

      // Let async operations complete
      await vi.advanceTimersByTimeAsync(0);

      expect(mockIsGitRepo).toHaveBeenCalledWith('/path/to/repo');
      expect(mockGetGitStatus).toHaveBeenCalledWith('/path/to/repo');
    });

    it('updates state after loading', async () => {
      mockGetGitStatus.mockResolvedValue({
        branch: 'feature-1',
        staged: [{ path: 'file.ts', status: 'modified' }],
        unstaged: [],
        untracked: ['new-file.ts'],
      });

      const { state } = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(state().isRepo).toBe(true);
      expect(state().isLoading).toBe(false);
      expect(state().status?.branch).toBe('feature-1');
      expect(state().status?.staged).toHaveLength(1);
      expect(state().status?.untracked).toHaveLength(1);
    });

    it('handles non-git repo', async () => {
      mockIsGitRepo.mockResolvedValue(false);

      const { state } = gitWatcherService.subscribe('lane-1', '/path/to/dir');
      await vi.advanceTimersByTimeAsync(0);

      expect(state().isRepo).toBe(false);
      expect(state().status).toBeNull();
      expect(state().isLoading).toBe(false);
    });

    it('handles git API errors', async () => {
      mockIsGitRepo.mockRejectedValue(new Error('git error'));

      const { state } = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(state().error).toBe('git error');
      expect(state().isLoading).toBe(false);
    });

    it('reuses watcher for same lane', () => {
      const sub1 = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      const sub2 = gitWatcherService.subscribe('lane-1', '/path/to/repo');

      // Should return the same state accessor
      expect(sub1.state).toBe(sub2.state);

      // isGitRepo should only be called once (one watcher)
      expect(mockIsGitRepo).toHaveBeenCalledTimes(1);
    });

    it('starts file watching for git repos', async () => {
      gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockWatchDirectory).toHaveBeenCalledWith(
        '/path/to/repo',
        expect.any(Function),
        true,
      );
    });

    it('does not start file watching for non-git dirs', async () => {
      mockIsGitRepo.mockResolvedValue(false);

      gitWatcherService.subscribe('lane-1', '/path/to/dir');
      await vi.advanceTimersByTimeAsync(0);

      expect(mockWatchDirectory).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('cleans up when last subscriber leaves', async () => {
      const { unsubscribe } = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      unsubscribe();

      // hasChanges should return false for disposed lane
      expect(gitWatcherService.hasChanges('lane-1')).toBe(false);
    });

    it('keeps watcher alive when other subscribers exist', async () => {
      const sub1 = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      const sub2 = gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      sub1.unsubscribe();

      // Should still be watchable
      const state = sub2.state();
      expect(state.isRepo).toBe(true);
    });
  });

  describe('refresh', () => {
    it('reloads git status for a lane', async () => {
      gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      mockGetGitStatus.mockClear();
      mockIsGitRepo.mockClear();

      await gitWatcherService.refresh('lane-1');

      expect(mockIsGitRepo).toHaveBeenCalled();
      expect(mockGetGitStatus).toHaveBeenCalled();
    });

    it('does nothing for unknown lane', async () => {
      await gitWatcherService.refresh('nonexistent');
      // Should not throw
    });
  });

  describe('hasChanges', () => {
    it('returns false for unknown lane', () => {
      expect(gitWatcherService.hasChanges('nonexistent')).toBe(false);
    });

    it('returns false when no changes', async () => {
      gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(gitWatcherService.hasChanges('lane-1')).toBe(false);
    });

    it('returns true when there are staged changes', async () => {
      mockGetGitStatus.mockResolvedValue({
        branch: 'main',
        staged: [{ path: 'file.ts', status: 'modified' }],
        unstaged: [],
        untracked: [],
      });

      gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(gitWatcherService.hasChanges('lane-1')).toBe(true);
    });

    it('returns true when there are untracked files', async () => {
      mockGetGitStatus.mockResolvedValue({
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: ['new-file.ts'],
      });

      gitWatcherService.subscribe('lane-1', '/path/to/repo');
      await vi.advanceTimersByTimeAsync(0);

      expect(gitWatcherService.hasChanges('lane-1')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('cleans up all watchers', async () => {
      gitWatcherService.subscribe('lane-1', '/path/one');
      gitWatcherService.subscribe('lane-2', '/path/two');
      await vi.advanceTimersByTimeAsync(0);

      gitWatcherService.dispose();

      expect(gitWatcherService.hasChanges('lane-1')).toBe(false);
      expect(gitWatcherService.hasChanges('lane-2')).toBe(false);
    });
  });
});
