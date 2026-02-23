/**
 * PRConversationPanel - Displays overall PR conversation comments
 *
 * Shows top-level issue comments (not inline review comments) in a
 * collapsible section before the SUBMIT REVIEW actions.
 */

import { createSignal, Show, For } from 'solid-js';
import type { PrConversationComment } from '../../types/review';

interface PRConversationPanelProps {
  comments: PrConversationComment[];
  loading?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function associationBadge(assoc: string): string | null {
  switch (assoc.toUpperCase()) {
    case 'OWNER': return 'Owner';
    case 'MEMBER': return 'Member';
    case 'COLLABORATOR': return 'Collaborator';
    default: return null;
  }
}

export function PRConversationPanel(props: PRConversationPanelProps) {
  const [expanded, setExpanded] = createSignal(true);

  return (
    <div class="border-t border-zed-border-subtle">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(v => !v)}
        class="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zed-text-secondary uppercase tracking-wider hover:bg-zed-bg-hover/50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg
            class="w-3.5 h-3.5 transition-transform"
            classList={{ 'rotate-90': expanded() }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span>PR Comments</span>
          <span class="text-[10px] px-1.5 py-0 rounded-full bg-purple-500/20 text-purple-400 normal-case">
            {props.comments.length}
          </span>
        </div>
        <Show when={props.loading}>
          <div class="w-3 h-3 border border-purple-500/50 border-t-purple-500 rounded-full animate-spin" />
        </Show>
      </button>

      {/* Comment list */}
      <Show when={expanded()}>
        <div class="max-h-64 overflow-y-auto px-3 pb-3 space-y-2">
          <For each={props.comments}>
            {(comment) => {
              const badge = associationBadge(comment.authorAssociation);
              return (
                <div class="rounded-md px-3 py-2 bg-zed-bg-app/50 border border-zed-border-subtle">
                  {/* Comment header */}
                  <div class="flex items-center gap-1.5 mb-1">
                    {/* Avatar placeholder */}
                    <div class="w-4 h-4 rounded-full bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                      <span class="text-[8px] text-purple-400 font-medium">
                        {comment.user.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span class="text-xs font-medium text-zed-text-primary">@{comment.user}</span>
                    <Show when={badge}>
                      <span class="text-[9px] px-1 py-0 rounded bg-zed-bg-hover text-zed-text-tertiary">
                        {badge}
                      </span>
                    </Show>
                    <span class="text-[10px] text-zed-text-tertiary ml-auto flex-shrink-0">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  {/* Comment body */}
                  <div class="text-xs text-zed-text-secondary leading-relaxed whitespace-pre-wrap break-words">
                    {comment.body}
                  </div>
                </div>
              );
            }}
          </For>
          <Show when={props.comments.length === 0 && !props.loading}>
            <p class="text-xs text-zed-text-tertiary text-center py-2">No conversation comments yet</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
