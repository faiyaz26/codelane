// Hook for Shiki syntax highlighting of markdown source
// Handles async highlighting with proper cleanup

import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createHighlighter, type Highlighter } from 'shiki';
import { themeManager, getShikiTheme, getAllShikiThemes } from '../../../../services/ThemeManager';

// Shiki highlighter singleton - shared across all instances
let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: getAllShikiThemes(),
      langs: ['markdown'],
    });
  }
  return highlighterPromise;
}

// Escape HTML for fallback rendering
function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface UseShikiHighlighterOptions {
  content: () => string;
}

export function useShikiHighlighter(options: UseShikiHighlighterOptions) {
  const [highlightedHtml, setHighlightedHtml] = createSignal('');

  // Track current highlight request to cancel stale ones
  let currentRequestId = 0;

  createEffect(() => {
    const content = options.content();
    const currentTheme = themeManager.getTheme()();

    if (!content) {
      setHighlightedHtml('');
      return;
    }

    // Increment request ID to invalidate any in-flight requests
    const requestId = ++currentRequestId;

    (async () => {
      try {
        const highlighter = await getHighlighter();

        // Check if this request is still current
        if (requestId !== currentRequestId) return;

        const html = highlighter.codeToHtml(content, {
          lang: 'markdown',
          theme: getShikiTheme(currentTheme),
        });

        // Check again after highlighting
        if (requestId !== currentRequestId) return;

        setHighlightedHtml(html);
      } catch (err) {
        console.error('Failed to highlight markdown:', err);

        // Check if still current before fallback
        if (requestId !== currentRequestId) return;

        // Fallback to escaped HTML
        setHighlightedHtml(`<pre><code>${escapeHtml(content)}</code></pre>`);
      }
    })();
  });

  // Cancel any pending requests on cleanup
  onCleanup(() => {
    currentRequestId++;
  });

  return highlightedHtml;
}
