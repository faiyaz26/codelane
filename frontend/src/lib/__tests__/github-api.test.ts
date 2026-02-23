import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrReviewComment, PrConversationComment } from '../../types/review';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const {
  fetchPrReviewComments,
  fetchPrConversation,
  submitReviewWithComments,
} = await import('../github-api');

describe('GitHub API - PR Review Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPrReviewComments', () => {
    it('invokes the correct Tauri command with params', async () => {
      const mockComments: PrReviewComment[] = [
        {
          id: 1,
          path: 'src/index.ts',
          line: 10,
          originalLine: 10,
          side: 'RIGHT',
          body: 'Nice code',
          user: 'reviewer',
          createdAt: '2026-02-20T10:00:00Z',
          updatedAt: '2026-02-20T10:00:00Z',
          inReplyToId: null,
        },
      ];
      mockInvoke.mockResolvedValue(mockComments);

      const result = await fetchPrReviewComments('org/repo', 42);

      expect(mockInvoke).toHaveBeenCalledWith('github_fetch_pr_review_comments', {
        repoName: 'org/repo',
        prNumber: 42,
      });
      expect(result).toEqual(mockComments);
    });

    it('propagates errors from Tauri', async () => {
      mockInvoke.mockRejectedValue(new Error('gh not found'));

      await expect(fetchPrReviewComments('org/repo', 1)).rejects.toThrow('gh not found');
    });
  });

  describe('fetchPrConversation', () => {
    it('invokes the correct Tauri command with params', async () => {
      const mockComments: PrConversationComment[] = [
        {
          id: 100,
          body: 'LGTM',
          user: 'commenter',
          createdAt: '2026-02-20T09:00:00Z',
          updatedAt: '2026-02-20T09:00:00Z',
          authorAssociation: 'MEMBER',
        },
      ];
      mockInvoke.mockResolvedValue(mockComments);

      const result = await fetchPrConversation('org/repo', 42);

      expect(mockInvoke).toHaveBeenCalledWith('github_fetch_pr_conversation', {
        repoName: 'org/repo',
        prNumber: 42,
      });
      expect(result).toEqual(mockComments);
    });

    it('propagates errors from Tauri', async () => {
      mockInvoke.mockRejectedValue(new Error('network error'));

      await expect(fetchPrConversation('org/repo', 1)).rejects.toThrow('network error');
    });
  });

  describe('submitReviewWithComments', () => {
    it('invokes the correct Tauri command with full params', async () => {
      mockInvoke.mockResolvedValue('Review submitted');

      const params = {
        repoName: 'org/repo',
        prNumber: 42,
        commitId: 'abc123def',
        event: 'APPROVE',
        body: 'Looks good!',
        comments: [
          { path: 'src/index.ts', line: 10, side: 'RIGHT', body: 'Nice' },
          { path: 'src/utils.ts', line: 25, side: 'RIGHT', body: 'Consider refactoring' },
        ],
      };

      const result = await submitReviewWithComments(params);

      expect(mockInvoke).toHaveBeenCalledWith('github_submit_review_with_comments', params);
      expect(result).toBe('Review submitted');
    });

    it('works without optional body', async () => {
      mockInvoke.mockResolvedValue('Review submitted');

      const params = {
        repoName: 'org/repo',
        prNumber: 42,
        commitId: 'abc123def',
        event: 'COMMENT',
        comments: [
          { path: 'src/index.ts', line: 10, side: 'RIGHT', body: 'Fix this' },
        ],
      };

      const result = await submitReviewWithComments(params);

      expect(mockInvoke).toHaveBeenCalledWith('github_submit_review_with_comments', params);
      expect(result).toBe('Review submitted');
    });

    it('propagates errors from Tauri', async () => {
      mockInvoke.mockRejectedValue(new Error('permission denied'));

      await expect(
        submitReviewWithComments({
          repoName: 'org/repo',
          prNumber: 42,
          commitId: 'abc',
          event: 'APPROVE',
          comments: [],
        })
      ).rejects.toThrow('permission denied');
    });
  });
});
