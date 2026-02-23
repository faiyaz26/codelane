import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

// Mock dependencies that CodeReviewStore imports
vi.mock('../review/ReviewOrchestrator', () => ({
  reviewOrchestrator: {
    generateReview: vi.fn(),
    cancelReview: vi.fn(),
  },
}));

vi.mock('../review/ReviewScrollCoordinator', () => ({
  reviewScrollCoordinator: {
    setVisibleFile: vi.fn(),
    requestScrollToFile: vi.fn(),
    getReviewContext: vi.fn(() => ''),
  },
}));

// Must import after mocks
const { codeReviewStore } = await import('../CodeReviewStore');

describe('CodeReviewStore - Pending Comments', () => {
  const laneId = 'test-lane';

  beforeEach(() => {
    codeReviewStore.reset(laneId);
  });

  it('starts with empty pending comments', () => {
    createRoot(() => {
      const state = codeReviewStore.getState(laneId);
      expect(state().pendingComments).toEqual([]);
    });
  });

  it('adds a pending comment', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/index.ts', 42, 'Fix this bug');

      const state = codeReviewStore.getState(laneId);
      const comments = state().pendingComments;

      expect(comments).toHaveLength(1);
      expect(comments[0].path).toBe('src/index.ts');
      expect(comments[0].line).toBe(42);
      expect(comments[0].body).toBe('Fix this bug');
      expect(comments[0].side).toBe('RIGHT');
      expect(comments[0].status).toBe('pending');
      expect(comments[0].id).toBeTruthy();
      expect(comments[0].createdAt).toBeGreaterThan(0);
    });
  });

  it('adds multiple pending comments', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Comment 1');
      codeReviewStore.addPendingComment(laneId, 'src/b.ts', 20, 'Comment 2');
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 30, 'Comment 3');

      const state = codeReviewStore.getState(laneId);
      const comments = state().pendingComments;

      expect(comments).toHaveLength(3);
      expect(comments[0].body).toBe('Comment 1');
      expect(comments[1].body).toBe('Comment 2');
      expect(comments[2].body).toBe('Comment 3');
    });
  });

  it('generates unique IDs for each comment', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Comment 1');
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 20, 'Comment 2');

      const state = codeReviewStore.getState(laneId);
      const ids = state().pendingComments.map(c => c.id);

      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  it('updates a pending comment body', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/index.ts', 42, 'Original text');

      const commentId = codeReviewStore.getState(laneId)().pendingComments[0].id;

      codeReviewStore.updatePendingComment(laneId, commentId, 'Updated text');

      const state = codeReviewStore.getState(laneId);
      const comment = state().pendingComments[0];

      expect(comment.body).toBe('Updated text');
      expect(comment.id).toBe(commentId);
      expect(comment.path).toBe('src/index.ts');
      expect(comment.line).toBe(42);
    });
  });

  it('only updates the targeted comment', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'First');
      codeReviewStore.addPendingComment(laneId, 'src/b.ts', 20, 'Second');

      const firstId = codeReviewStore.getState(laneId)().pendingComments[0].id;

      codeReviewStore.updatePendingComment(laneId, firstId, 'First updated');

      const comments = codeReviewStore.getState(laneId)().pendingComments;
      expect(comments[0].body).toBe('First updated');
      expect(comments[1].body).toBe('Second');
    });
  });

  it('removes a pending comment', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/index.ts', 42, 'To be removed');

      const commentId = codeReviewStore.getState(laneId)().pendingComments[0].id;

      codeReviewStore.removePendingComment(laneId, commentId);

      const state = codeReviewStore.getState(laneId);
      expect(state().pendingComments).toHaveLength(0);
    });
  });

  it('only removes the targeted comment', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Keep');
      codeReviewStore.addPendingComment(laneId, 'src/b.ts', 20, 'Remove');
      codeReviewStore.addPendingComment(laneId, 'src/c.ts', 30, 'Keep too');

      const removeId = codeReviewStore.getState(laneId)().pendingComments[1].id;

      codeReviewStore.removePendingComment(laneId, removeId);

      const comments = codeReviewStore.getState(laneId)().pendingComments;
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe('Keep');
      expect(comments[1].body).toBe('Keep too');
    });
  });

  it('clears all pending comments', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Comment 1');
      codeReviewStore.addPendingComment(laneId, 'src/b.ts', 20, 'Comment 2');
      codeReviewStore.addPendingComment(laneId, 'src/c.ts', 30, 'Comment 3');

      codeReviewStore.clearPendingComments(laneId);

      const state = codeReviewStore.getState(laneId);
      expect(state().pendingComments).toHaveLength(0);
    });
  });

  it('isolates pending comments per lane', () => {
    createRoot(() => {
      const lane1 = 'lane-1';
      const lane2 = 'lane-2';

      codeReviewStore.addPendingComment(lane1, 'src/a.ts', 10, 'Lane 1 comment');
      codeReviewStore.addPendingComment(lane2, 'src/b.ts', 20, 'Lane 2 comment');

      expect(codeReviewStore.getState(lane1)().pendingComments).toHaveLength(1);
      expect(codeReviewStore.getState(lane2)().pendingComments).toHaveLength(1);
      expect(codeReviewStore.getState(lane1)().pendingComments[0].body).toBe('Lane 1 comment');
      expect(codeReviewStore.getState(lane2)().pendingComments[0].body).toBe('Lane 2 comment');

      codeReviewStore.clearPendingComments(lane1);

      expect(codeReviewStore.getState(lane1)().pendingComments).toHaveLength(0);
      expect(codeReviewStore.getState(lane2)().pendingComments).toHaveLength(1);
    });
  });

  it('handles update for non-existent comment ID gracefully', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Original');

      codeReviewStore.updatePendingComment(laneId, 'non-existent-id', 'Updated');

      const comments = codeReviewStore.getState(laneId)().pendingComments;
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Original');
    });
  });

  it('handles remove for non-existent comment ID gracefully', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Keep me');

      codeReviewStore.removePendingComment(laneId, 'non-existent-id');

      const comments = codeReviewStore.getState(laneId)().pendingComments;
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('Keep me');
    });
  });

  it('reset clears pending comments along with other state', () => {
    createRoot(() => {
      codeReviewStore.addPendingComment(laneId, 'src/a.ts', 10, 'Comment');

      codeReviewStore.reset(laneId);

      const state = codeReviewStore.getState(laneId);
      expect(state().pendingComments).toHaveLength(0);
      expect(state().prReviewComments).toEqual([]);
      expect(state().prConversationComments).toEqual([]);
      expect(state().prCommentsLoading).toBe(false);
    });
  });
});
