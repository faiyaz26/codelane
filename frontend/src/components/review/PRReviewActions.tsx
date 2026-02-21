/**
 * PRReviewActions - Action buttons for submitting a PR review
 *
 * Allows user to approve, comment, or request changes on a PR.
 * Only shown in PR review lanes when the review is ready.
 */

import { createSignal, Show } from 'solid-js';
import { submitPrReview } from '../../lib/github-api';

interface PRReviewActionsProps {
  prUrl: string;
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

      // Comment and request_changes require a body
      if ((reviewType === 'comment' || reviewType === 'request_changes') && !body) {
        setResult({ type: 'error', message: 'A comment is required for this action' });
        setSubmitting(false);
        return;
      }

      await submitPrReview(props.prUrl, reviewType, body);
      setResult({ type: 'success', message: `Review submitted: ${reviewType.replace('_', ' ')}` });
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

      <textarea
        class="w-full h-20 px-3 py-2 text-sm bg-zed-bg-app border border-zed-border-subtle rounded-md text-zed-text-primary placeholder-zed-text-tertiary resize-none focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
        placeholder="Leave a comment (optional for approve)..."
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
