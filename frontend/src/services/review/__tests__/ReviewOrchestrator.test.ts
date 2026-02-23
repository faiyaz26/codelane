import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';
import type { PrReviewComment, PrConversationComment } from '../../../types/review';

// Mock all external dependencies
vi.mock('../ReviewFileProcessor', () => ({
  reviewFileProcessor: {
    fetchChangesWithStats: vi.fn(() => Promise.resolve([])),
    fetchBranchChangesWithStats: vi.fn(() => Promise.resolve([])),
    fetchFileDiffs: vi.fn(() => Promise.resolve(new Map())),
    fetchBranchDiffs: vi.fn(() => Promise.resolve(new Map())),
    sortFiles: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../AIReviewService', () => ({
  aiReviewService: {
    generateReview: vi.fn(() => Promise.resolve({ success: true, content: '## Summary' })),
    generateFileReview: vi.fn(() => Promise.resolve({ success: true, content: 'Looks good' })),
  },
}));

vi.mock('../../CodeReviewSettingsManager', () => ({
  codeReviewSettingsManager: {
    getSettings: vi.fn(() => () => ({
      reviewModel: null,
      reviewPrompt: '',
      filePrompt: '',
      concurrency: 2,
      excludeCategories: [],
      customExcludePatterns: [],
    })),
  },
}));

vi.mock('../../../lib/settings-api', () => ({
  getReviewTool: vi.fn(() => Promise.resolve({ type: 'mock', label: 'Mock' })),
}));

vi.mock('../../../utils/diffTruncation', () => ({
  processDiffsWithTruncation: vi.fn((diffs: Map<string, string>) => diffs),
  getTruncationSummary: vi.fn(() => ({ truncated: 0, files: [] })),
}));

vi.mock('../../../utils/fileFilters', () => ({
  filterReviewableFiles: vi.fn((files: unknown[]) => files),
  getExclusionSummary: vi.fn(() => ({ excluded: 0, files: [] })),
}));

vi.mock('../../../utils/changesetChecksum', () => ({
  computeChangesetChecksum: vi.fn(() => 'mock-checksum'),
}));

const mockFetchPrReviewComments = vi.fn<(repo: string, pr: number) => Promise<PrReviewComment[]>>();
const mockFetchPrConversation = vi.fn<(repo: string, pr: number) => Promise<PrConversationComment[]>>();

vi.mock('../../../lib/github-api', () => ({
  fetchPrReviewComments: (...args: [string, number]) => mockFetchPrReviewComments(...args),
  fetchPrConversation: (...args: [string, number]) => mockFetchPrConversation(...args),
}));

// Import after mocking
const { ReviewOrchestrator } = await import('../ReviewOrchestrator');
const { reviewStateManager } = await import('../ReviewStateManager');

describe('ReviewOrchestrator - PR Comment Fetching', () => {
  let orchestrator: InstanceType<typeof ReviewOrchestrator>;
  const laneId = 'test-pr-lane';

  const mockReviewComments: PrReviewComment[] = [
    {
      id: 101,
      path: 'src/index.ts',
      line: 42,
      originalLine: 40,
      side: 'RIGHT',
      body: 'Consider using const here',
      user: 'reviewer1',
      createdAt: '2026-02-20T10:00:00Z',
      updatedAt: '2026-02-20T10:00:00Z',
      inReplyToId: null,
    },
    {
      id: 102,
      path: 'src/utils.ts',
      line: 15,
      originalLine: null,
      side: 'RIGHT',
      body: 'This function should be pure',
      user: 'reviewer2',
      createdAt: '2026-02-20T11:00:00Z',
      updatedAt: '2026-02-20T11:00:00Z',
      inReplyToId: null,
    },
  ];

  const mockConversationComments: PrConversationComment[] = [
    {
      id: 201,
      body: 'Great PR, just a few nits',
      user: 'reviewer1',
      createdAt: '2026-02-20T09:00:00Z',
      updatedAt: '2026-02-20T09:00:00Z',
      authorAssociation: 'MEMBER',
    },
  ];

  beforeEach(() => {
    orchestrator = new ReviewOrchestrator();
    reviewStateManager.resetState(laneId);
    vi.clearAllMocks();

    mockFetchPrReviewComments.mockResolvedValue(mockReviewComments);
    mockFetchPrConversation.mockResolvedValue(mockConversationComments);
  });

  it('fetches PR comments when prMetadata is provided', async () => {
    await createRoot(async () => {
      const prMetadata = {
        number: 123,
        title: 'Test PR',
        author: 'dev',
        baseBranch: 'main',
        headBranch: 'feature',
        headSha: 'abc123',
        prUrl: 'https://github.com/org/repo/pull/123',
        repoName: 'org/repo',
        body: '',
        state: 'open',
        filesChanged: 2,
        additions: 10,
        deletions: 5,
      };

      await orchestrator.generateReview(laneId, '/tmp/test', {
        scope: 'branch_diff',
        baseBranch: 'main',
        prMetadata,
      });

      expect(mockFetchPrReviewComments).toHaveBeenCalledWith('org/repo', 123);
      expect(mockFetchPrConversation).toHaveBeenCalledWith('org/repo', 123);

      // Wait for parallel fetch to complete
      await vi.waitFor(() => {
        const state = reviewStateManager.getStateSnapshot(laneId);
        expect(state.prReviewComments).toEqual(mockReviewComments);
        expect(state.prConversationComments).toEqual(mockConversationComments);
        expect(state.prCommentsLoading).toBe(false);
      });
    });
  });

  it('does not fetch PR comments when no prMetadata', async () => {
    await createRoot(async () => {
      await orchestrator.generateReview(laneId, '/tmp/test');

      expect(mockFetchPrReviewComments).not.toHaveBeenCalled();
      expect(mockFetchPrConversation).not.toHaveBeenCalled();

      const state = reviewStateManager.getStateSnapshot(laneId);
      expect(state.prReviewComments).toEqual([]);
      expect(state.prConversationComments).toEqual([]);
    });
  });

  it('handles PR comment fetch failure gracefully', async () => {
    mockFetchPrReviewComments.mockRejectedValue(new Error('API rate limit'));
    mockFetchPrConversation.mockRejectedValue(new Error('API rate limit'));

    await createRoot(async () => {
      const prMetadata = {
        number: 456,
        title: 'Test PR',
        author: 'dev',
        baseBranch: 'main',
        headBranch: 'feature',
        headSha: 'def456',
        prUrl: 'https://github.com/org/repo/pull/456',
        repoName: 'org/repo',
        body: '',
        state: 'open',
        filesChanged: 1,
        additions: 5,
        deletions: 2,
      };

      // Should not throw - errors are caught internally
      await orchestrator.generateReview(laneId, '/tmp/test', {
        scope: 'branch_diff',
        baseBranch: 'main',
        prMetadata,
      });

      // Wait for the parallel fetch to settle
      await vi.waitFor(() => {
        const state = reviewStateManager.getStateSnapshot(laneId);
        expect(state.prCommentsLoading).toBe(false);
      });

      // Review should still complete successfully (no changes = ready with no-changes message)
      const state = reviewStateManager.getStateSnapshot(laneId);
      expect(state.status).toBe('ready');
      // Comments should remain empty after failed fetch
      expect(state.prReviewComments).toEqual([]);
      expect(state.prConversationComments).toEqual([]);
    });
  });

  it('sets prCommentsLoading during fetch', async () => {
    // Create a deferred promise to control timing
    let resolveComments!: (value: PrReviewComment[]) => void;
    mockFetchPrReviewComments.mockReturnValue(
      new Promise<PrReviewComment[]>(resolve => { resolveComments = resolve; })
    );
    mockFetchPrConversation.mockResolvedValue([]);

    await createRoot(async () => {
      const prMetadata = {
        number: 789,
        title: 'Test PR',
        author: 'dev',
        baseBranch: 'main',
        headBranch: 'feature',
        headSha: 'ghi789',
        prUrl: 'https://github.com/org/repo/pull/789',
        repoName: 'org/repo',
        body: '',
        state: 'open',
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      };

      // Start the review (fires PR comment fetch in parallel)
      const reviewPromise = orchestrator.generateReview(laneId, '/tmp/test', {
        scope: 'branch_diff',
        baseBranch: 'main',
        prMetadata,
      });

      // At this point, prCommentsLoading should be true
      // (it's set synchronously before the async fetch)
      await new Promise(r => setTimeout(r, 10));

      // Resolve the pending fetch
      resolveComments(mockReviewComments);
      await reviewPromise;

      // After everything resolves, loading should be false
      await vi.waitFor(() => {
        const state = reviewStateManager.getStateSnapshot(laneId);
        expect(state.prCommentsLoading).toBe(false);
      });
    });
  });
});
