/**
 * MarkdownRenderer - Unified markdown rendering component
 *
 * Supports two rendering modes:
 * - 'full': Complete markdown features (code blocks, blockquotes, headers, lists, hr, inline styles)
 * - 'simple': Lightweight subset (headers, lists, inline code, bold)
 */

import { createMemo } from 'solid-js';

export type MarkdownMode = 'full' | 'simple';

export interface MarkdownRendererProps {
  markdown: string;
  mode?: MarkdownMode;
  class?: string;
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const mode = () => props.mode || 'full';

  const renderedHtml = createMemo(() => {
    if (mode() === 'simple') {
      return simpleMarkdownToHtml(props.markdown);
    }
    return fullMarkdownToHtml(props.markdown);
  });

  return <div class={props.class} innerHTML={renderedHtml()} />;
}

/**
 * Full markdown renderer with all features.
 * Handles: headers, bold, italic, inline code, code blocks, lists, blockquotes, hr, paragraphs.
 */
function fullMarkdownToHtml(md: string): string {
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
      html.push(`<h3>${fullInlineFormat(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<h2>${fullInlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<h1>${fullInlineFormat(line.slice(2))}</h1>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { html.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      html.push(`<blockquote>${fullInlineFormat(line.slice(2))}</blockquote>`);
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
      html.push(`<li>${fullInlineFormat(line.slice(2))}</li>`);
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
      html.push(`<li>${fullInlineFormat(line.replace(/^\d+\.\s/, ''))}</li>`);
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
    html.push(`<p>${fullInlineFormat(line)}</p>`);
  }

  // Close any open lists or code blocks
  if (inList) html.push(listType === 'ul' ? '</ul>' : '</ol>');
  if (inCodeBlock) html.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`);

  return html.join('\n');
}

/**
 * Simple markdown renderer with lightweight subset.
 * Handles: headers, lists, inline code, bold, paragraphs.
 */
function simpleMarkdownToHtml(md: string): string {
  return md
    .split('\n')
    .map(line => {
      // Headers
      if (line.startsWith('### ')) return `<h3>${simpleInlineFormat(line.slice(4))}</h3>`;
      if (line.startsWith('## ')) return `<h2>${simpleInlineFormat(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${simpleInlineFormat(line.slice(2))}</h1>`;

      // List items
      if (line.match(/^[-*]\s/)) {
        const content = line.slice(2);
        return `<li>${simpleInlineFormat(content)}</li>`;
      }
      if (line.match(/^\d+\.\s/)) {
        const content = line.replace(/^\d+\.\s/, '');
        return `<li>${simpleInlineFormat(content)}</li>`;
      }

      // Empty line
      if (line.trim() === '') return '<br/>';

      // Regular paragraph
      return `<p>${simpleInlineFormat(line)}</p>`;
    })
    .join('\n');
}

/**
 * Full inline formatting with bold, italic, and inline code.
 */
function fullInlineFormat(text: string): string {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  return html;
}

/**
 * Simple inline formatting with bold and inline code only.
 */
function simpleInlineFormat(text: string): string {
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  return html;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
