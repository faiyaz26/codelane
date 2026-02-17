/**
 * ReviewSummaryPanel - Left half of the code review layout
 *
 * Renders the AI-generated review summary as read-only markdown.
 * Has a header with timestamp and regenerate button.
 */

import { Show, createMemo } from 'solid-js';
import { MarkdownRenderer } from '../../lib/markdown/MarkdownRenderer';

interface ReviewSummaryPanelProps {
  markdown: string;
  generatedAt: number | null;
  isLoading: boolean;
  onRegenerate: () => void;
}

export function ReviewSummaryPanel(props: ReviewSummaryPanelProps) {
  // Memoize date formatting to avoid repeated new Date() calls on every render
  // Impact: Date formatting is relatively expensive; worth caching when displayed
  const formattedTime = createMemo(() => {
    if (!props.generatedAt) return '';
    return new Date(props.generatedAt).toLocaleString();
  });

  return (
    <section class="flex flex-col h-full overflow-hidden bg-zed-bg-app" aria-labelledby="review-summary-heading">
      {/* Header */}
      <header class="px-4 py-2 border-b border-zed-border-subtle bg-zed-bg-panel flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h2 id="review-summary-heading" class="text-sm font-medium text-zed-text-primary">AI Review Summary</h2>
        </div>
        <div class="flex items-center gap-2">
          <Show when={formattedTime()}>
            <span class="text-xs text-zed-text-tertiary">{formattedTime()}</span>
          </Show>
          <button
            onClick={props.onRegenerate}
            disabled={props.isLoading}
            aria-label="Regenerate AI review summary"
            class="px-2 py-1 text-xs bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-active rounded transition-colors disabled:opacity-50"
            title="Regenerate review"
          >
            <Show when={props.isLoading} fallback="Regenerate">
              Generating...
            </Show>
          </button>
        </div>
      </header>

      {/* Markdown Content */}
      <article class="flex-1 overflow-y-auto p-4">
        <MarkdownRenderer
          markdown={props.markdown}
          mode="full"
          class="prose prose-sm prose-invert max-w-none text-zed-text-secondary leading-relaxed [&_h1]:text-lg [&_h1]:text-zed-text-primary [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:text-zed-text-primary [&_h2]:font-medium [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:text-zed-text-primary [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-2 [&_strong]:text-zed-text-primary [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_code]:bg-zed-bg-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-zed-accent-blue [&_code]:text-xs [&_pre]:bg-zed-bg-panel [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-zed-accent-blue/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:border-zed-border-subtle"
        />
      </article>
    </section>
  );
}

