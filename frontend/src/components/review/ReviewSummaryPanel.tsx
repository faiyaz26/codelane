/**
 * ReviewSummaryPanel - Left half of the code review layout
 *
 * Renders the AI-generated review summary as read-only markdown.
 * Has a header with timestamp and regenerate button.
 */

import { Show } from 'solid-js';

interface ReviewSummaryPanelProps {
  markdown: string;
  generatedAt: number | null;
  isLoading: boolean;
  onRegenerate: () => void;
}

export function ReviewSummaryPanel(props: ReviewSummaryPanelProps) {
  const formattedTime = () => {
    if (!props.generatedAt) return '';
    return new Date(props.generatedAt).toLocaleString();
  };

  return (
    <div class="flex flex-col h-full overflow-hidden bg-zed-bg-app">
      {/* Header */}
      <div class="px-4 py-2 border-b border-zed-border-subtle bg-zed-bg-panel flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span class="text-sm font-medium text-zed-text-primary">AI Review Summary</span>
        </div>
        <div class="flex items-center gap-2">
          <Show when={formattedTime()}>
            <span class="text-xs text-zed-text-tertiary">{formattedTime()}</span>
          </Show>
          <button
            onClick={props.onRegenerate}
            disabled={props.isLoading}
            class="px-2 py-1 text-xs bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-active rounded transition-colors disabled:opacity-50"
            title="Regenerate review"
          >
            <Show when={props.isLoading} fallback="Regenerate">
              Generating...
            </Show>
          </button>
        </div>
      </div>

      {/* Markdown Content */}
      <div class="flex-1 overflow-y-auto p-4">
        <div
          class="prose prose-sm prose-invert max-w-none text-zed-text-secondary leading-relaxed [&_h1]:text-lg [&_h1]:text-zed-text-primary [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:mt-4 [&_h2]:text-base [&_h2]:text-zed-text-primary [&_h2]:font-medium [&_h2]:mb-2 [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:text-zed-text-primary [&_h3]:font-medium [&_h3]:mb-2 [&_h3]:mt-2 [&_strong]:text-zed-text-primary [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_p]:my-2 [&_code]:bg-zed-bg-hover [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-zed-accent-blue [&_code]:text-xs [&_pre]:bg-zed-bg-panel [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-zed-accent-blue/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:border-zed-border-subtle"
          innerHTML={markdownToHtml(props.markdown)}
        />
      </div>
    </div>
  );
}

/**
 * Markdown to HTML renderer for the review summary.
 * Handles: headers, bold, italic, inline code, code blocks, lists, blockquotes, hr, paragraphs.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code class="language-${codeBlockLang}">${codeLines.map(escapeHtml).join('\n')}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim() || 'text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // HR
    if (line.match(/^---+$/)) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push('<hr/>');
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s/)) {
      if (!inList || listType !== 'ul') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      html.push(`<li>${inlineFormat(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      if (!inList || listType !== 'ol') {
        if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
        html.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      html.push(`<li>${inlineFormat(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // Close list if we hit a non-list line
    if (inList && line.trim() !== '') {
      html.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      continue;
    }

    // Regular paragraph
    html.push(`<p>${inlineFormat(line)}</p>`);
  }

  // Close any open lists
  if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
  if (inCodeBlock) html.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`);

  return html.join('\n');
}

function inlineFormat(text: string): string {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
