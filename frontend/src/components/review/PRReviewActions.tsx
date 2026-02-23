/**
 * PRReviewActions - Action buttons for submitting a PR review
 *
 * Allows user to approve, comment, or request changes on a PR.
 * Supports submitting pending inline comments alongside the review.
 * Only shown in PR review lanes when the review is ready.
 */

import { createSignal, Show } from 'solid-js';
import { submitPrReview, submitReviewWithComments } from '../../lib/github-api';
import type { PendingReviewComment } from '../../types/review';

interface PRReviewActionsProps {
  prUrl: string;
  repoName: string;
  prNumber: number;
  headSha: string;
  pendingComments: PendingReviewComment[];
  onCommentsSubmitted?: () => void;
}

export function PRReviewActions(props: PRReviewActionsProps) {
  const [comment, setComment] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [result, setResult] = createSignal<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (reviewType: 'approve' | 'comment' | 'request_changes') => {
    setSubmitting(true);
    setResult(null);

    try {
      const body = comment().trim() || undefined;

      const pending = props.pendingComments;

      // Comment and request_changes require a body OR pending inline comments
      if ((reviewType === 'comment' || reviewType === 'request_changes') && !body && pending.length === 0) {
        setResult({ type: 'error', message: 'A comment or inline comments are required for this action' });
        setSubmitting(false);
        return;
      }

      if (pending.length > 0) {
        // Map review type to GitHub API event format
        const eventMap: Record<string, string> = {
          approve: 'APPROVE',
          comment: 'COMMENT',
          request_changes: 'REQUEST_CHANGES',
        };

        await submitReviewWithComments({
          repoName: props.repoName,
          prNumber: props.prNumber,
          commitId: props.headSha,
          event: eventMap[reviewType],
          body: body,
          comments: pending.map(c => ({
            path: c.path,
            line: c.line,
            side: c.side,
            body: c.body,
          })),
        });

        props.onCommentsSubmitted?.();
        setResult({
          type: 'success',
          message: `Review submitted: ${reviewType.replace('_', ' ')} with ${pending.length} inline comment${pending.length > 1 ? 's' : ''}`,
        });
      } else {
        // No pending comments, use simple review submission
        await submitPrReview(props.prUrl, reviewType, body);
        setResult({ type: 'success', message: `Review submitted: ${reviewType.replace('_', ' ')}` });
      }

      setComment('');
    } catch (err) {
      setResult({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="border-t border-zed-border-subtle p-4 space-y-3">
      <h4 class="text-xs font-medium text-zed-text-secondary uppercase tracking-wider">Submit Review</h4>

      {/* Pending comments indicator */}
      <Show when={props.pendingComments.length > 0}>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/20">
          <svg class="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span class="text-xs text-yellow-400">
            {props.pendingComments.length} pending comment{props.pendingComments.length > 1 ? 's' : ''} will be submitted
          </span>
        </div>
      </Show>

      <textarea
        class="w-full h-20 px-3 py-2 text-sm bg-zed-bg-app border border-zed-border-subtle rounded-md text-zed-text-primary placeholder-zed-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
        placeholder={props.pendingComments.length > 0 ? "Leave a comment (optional when inline comments exist)..." : "Leave a comment (optional for approve)..."}
        value={comment()}
        onInput={(e) => setComment(e.currentTarget.value)}
        disabled={submitting()}
      />

      <div class="flex gap-2">
        <button
          onClick={() => handleSubmit('approve')}
          disabled={submitting()}
          class="flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Approve
        </button>
        <button
          onClick={() => handleSubmit('comment')}
          disabled={submitting()}
          class="flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary border border-zed-border-subtle disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Comment
        </button>
        <button
          onClick={() => handleSubmit('request_changes')}
          disabled={submitting()}
          class="flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Request Changes
        </button>
      </div>

      <Show when={result()}>
        {(r) => (
          <div
            class={`px-3 py-2 text-xs rounded ${
              r().type === 'success'
                ? 'bg-green-600/10 text-green-400 border border-green-600/20'
                : 'bg-red-600/10 text-red-400 border border-red-600/20'
            }`}
          >
            {r().message}
          </div>
        )}
      </Show>
    </div>
  );
}
