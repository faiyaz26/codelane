// File viewer component - displays file content with Shiki syntax highlighting

import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';
import type { OpenFile } from './types';
import { getLanguageDisplayName, getShikiLanguage } from './types';

// Singleton highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

// Get or create the highlighter
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark-default'],
      langs: [], // Start with no languages, load on demand
    });
  }
  return highlighterPromise;
}

// Ensure a language is loaded
async function ensureLanguageLoaded(highlighter: Highlighter, lang: string): Promise<string> {
  // Check if it's a valid bundled language
  const validLangs = [
    'javascript', 'jsx', 'typescript', 'tsx', 'html', 'css', 'scss', 'sass', 'less',
    'json', 'yaml', 'xml', 'toml', 'rust', 'python', 'go', 'java', 'c', 'cpp',
    'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'shellscript', 'markdown',
    'sql', 'dockerfile', 'makefile', 'cmake', 'dotenv', 'text'
  ];

  const targetLang = validLangs.includes(lang) ? lang : 'text';

  if (!loadedLanguages.has(targetLang) && targetLang !== 'text') {
    try {
      await highlighter.loadLanguage(targetLang as BundledLanguage);
      loadedLanguages.add(targetLang);
    } catch (e) {
      console.warn(`Failed to load language: ${targetLang}, falling back to text`);
      return 'text';
    }
  }

  return targetLang;
}

interface FileViewerProps {
  file: OpenFile | null;
}

export function FileViewer(props: FileViewerProps) {
  const [highlightedHtml, setHighlightedHtml] = createSignal<string>('');
  const [isHighlighting, setIsHighlighting] = createSignal(false);
  let codeContainerRef: HTMLDivElement | undefined;

  // Highlight code when file content changes
  createEffect(() => {
    const file = props.file;
    if (!file || file.isLoading || file.error || file.content === null) {
      setHighlightedHtml('');
      return;
    }

    const content = file.content;
    const language = getShikiLanguage(file.language);

    setIsHighlighting(true);

    (async () => {
      try {
        const highlighter = await getHighlighter();
        const loadedLang = await ensureLanguageLoaded(highlighter, language);

        const html = highlighter.codeToHtml(content, {
          lang: loadedLang,
          theme: 'github-dark-default',
        });

        setHighlightedHtml(html);
      } catch (err) {
        console.error('Highlighting failed:', err);
        // Fallback to plain text with escaped HTML
        const escaped = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setHighlightedHtml(`<pre class="shiki"><code>${escaped}</code></pre>`);
      } finally {
        setIsHighlighting(false);
      }
    })();
  });

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface">
      {/* No file selected state */}
      <Show when={!props.file}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg
              class="w-16 h-16 mx-auto mb-4 text-zed-text-disabled"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 class="text-lg font-medium text-zed-text-secondary mb-2">No file selected</h3>
            <p class="text-sm text-zed-text-tertiary max-w-xs">
              Select a file from the explorer to view its contents.
            </p>
          </div>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={props.file?.isLoading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg class="w-8 h-8 mx-auto mb-3 animate-spin text-zed-accent-blue" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p class="text-sm text-zed-text-secondary">Loading file...</p>
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={props.file?.error}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md">
            <svg
              class="w-12 h-12 mx-auto mb-3 text-zed-accent-red"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 class="text-sm font-medium text-zed-accent-red mb-2">Failed to load file</h3>
            <p class="text-xs text-zed-text-tertiary">{props.file?.error}</p>
          </div>
        </div>
      </Show>

      {/* File content */}
      <Show when={props.file && !props.file.isLoading && !props.file.error && props.file.content !== null}>
        {/* File info bar */}
        <div class="h-7 px-4 border-b border-zed-border-subtle flex items-center justify-between text-xs bg-zed-bg-panel">
          <div class="flex items-center gap-2 text-zed-text-tertiary truncate">
            <span class="truncate">{props.file!.path}</span>
          </div>
          <div class="flex items-center gap-4 text-zed-text-disabled flex-shrink-0">
            <span>{props.file!.content?.split('\n').length || 0} lines</span>
            <span>{getLanguageDisplayName(props.file!.language)}</span>
          </div>
        </div>

        {/* Code view */}
        <div class="flex-1 overflow-auto">
          <Show
            when={!isHighlighting() && highlightedHtml()}
            fallback={
              <div class="p-4 flex items-center gap-2 text-zed-text-tertiary">
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span class="text-sm">Highlighting...</span>
              </div>
            }
          >
            <div
              ref={codeContainerRef}
              class="shiki-container text-sm"
              innerHTML={highlightedHtml()}
            />
          </Show>
        </div>
      </Show>
    </div>
  );
}
