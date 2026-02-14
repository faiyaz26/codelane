/**
 * FileContextPanel - Bottom 1/3 of the right half
 *
 * Shows AI-generated per-file feedback for the currently visible file.
 * Content updates reactively based on scroll position in ReviewFileScrollView.
 */

import { Show } from 'solid-js';

interface FileContextPanelProps {
  filePath: string | null;
  feedback: string | null;
  fileStatus?: string;
}

export function FileContextPanel(props: FileContextPanelProps) {
  const getFileName = () => {
    if (!props.filePath) return '';
    const parts = props.filePath.split('/');
    return parts[parts.length - 1];
  };

  const getStatusColor = () => {
    switch (props.fileStatus) {
      case 'added': return 'text-green-400';
      case 'modified': return 'text-blue-400';
      case 'deleted': return 'text-red-400';
      case 'renamed': return 'text-yellow-400';
      default: return 'text-zed-text-secondary';
    }
  };

  const getStatusLetter = () => {
    switch (props.fileStatus) {
      case 'added': return 'A';
      case 'modified': return 'M';
      case 'deleted': return 'D';
      case 'renamed': return 'R';
      case 'copied': return 'C';
      default: return '?';
    }
  };

  return (
    <div class="flex flex-col h-full overflow-hidden bg-zed-bg-panel">
      {/* Header */}
      <div class="px-3 py-2 border-b border-zed-border-subtle flex items-center gap-2 flex-shrink-0">
        <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-medium text-zed-text-primary">File Context</span>
        <Show when={props.filePath && props.fileStatus}>
          <span class={`text-xs font-bold ${getStatusColor()}`}>{getStatusLetter()}</span>
          <span class="text-xs text-zed-text-secondary truncate">{getFileName()}</span>
        </Show>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-3">
        <Show
          when={props.filePath}
          fallback={
            <div class="flex flex-col items-center justify-center h-full text-center">
              <svg class="w-8 h-8 mb-2 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p class="text-xs text-zed-text-tertiary">Scroll through files to see context</p>
            </div>
          }
        >
          <Show
            when={props.feedback}
            fallback={
              <div class="flex flex-col items-center justify-center h-full text-center">
                <svg class="w-8 h-8 mb-2 text-zed-text-tertiary opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-xs text-zed-text-tertiary">No feedback for this file</p>
              </div>
            }
          >
            <div
              class="prose prose-sm prose-invert max-w-none text-xs text-zed-text-secondary leading-relaxed [&_h1]:text-sm [&_h1]:text-zed-text-primary [&_h2]:text-xs [&_h2]:text-zed-text-primary [&_h3]:text-xs [&_h3]:text-zed-text-primary [&_strong]:text-zed-text-primary [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5 [&_code]:bg-zed-bg-hover [&_code]:px-1 [&_code]:rounded [&_code]:text-zed-accent-blue"
              innerHTML={simpleMarkdownToHtml(props.feedback!)}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
}

/**
 * Very lightweight markdown → HTML for per-file feedback.
 * Handles: headers, bold, inline code, lists, paragraphs.
 */
function simpleMarkdownToHtml(md: string): string {
  return md
    .split('\n')
    .map(line => {
      // Headers
      if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;

      // List items
      if (line.match(/^[-*]\s/)) {
        const content = line.slice(2);
        return `<li>${inlineFormat(content)}</li>`;
      }
      if (line.match(/^\d+\.\s/)) {
        const content = line.replace(/^\d+\.\s/, '');
        return `<li>${inlineFormat(content)}</li>`;
      }

      // Empty line
      if (line.trim() === '') return '<br/>';

      // Regular paragraph
      return `<p>${inlineFormat(line)}</p>`;
    })
    .join('\n');
}

function inlineFormat(text: string): string {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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
