// DiffViewer - displays git diff output with syntax highlighting

import { createMemo, createSignal, createEffect, Show, onMount } from 'solid-js';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';
import { getShikiLanguage, detectLanguage } from './types';
import { themeManager, getShikiTheme } from '../../services/ThemeManager';

interface DiffViewerProps {
  diff: string;
  fileName: string;
}

interface DiffLine {
  content: string;
  type: 'added' | 'removed' | 'context' | 'header';
  lineNumber: number;
}

// Singleton highlighter
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [getShikiTheme()],
      langs: [],
    });
  }
  return highlighterPromise;
}

async function ensureLanguageLoaded(highlighter: Highlighter, lang: string): Promise<string> {
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

export function DiffViewer(props: DiffViewerProps) {
  const [highlightedLines, setHighlightedLines] = createSignal<Map<number, string>>(new Map());
  const [isHighlighting, setIsHighlighting] = createSignal(true);

  const parsedLines = createMemo((): DiffLine[] => {
    const lines = props.diff.split('\n');
    return lines
      .filter((line) => {
        // Filter out git metadata headers
        return (
          !line.startsWith('diff --git') &&
          !line.startsWith('index ') &&
          !line.startsWith('--- ') &&
          !line.startsWith('+++ ')
        );
      })
      .map((line, index) => {
        let type: DiffLine['type'] = 'context';
        if (line.startsWith('@@')) {
          type = 'header';
        } else if (line.startsWith('+')) {
          type = 'added';
        } else if (line.startsWith('-')) {
          type = 'removed';
        }

        return {
          content: line,
          type,
          lineNumber: index + 1,
        };
      });
  });

  // Calculate additions and deletions
  const stats = createMemo(() => {
    const lines = parsedLines();
    const additions = lines.filter((l) => l.type === 'added').length;
    const deletions = lines.filter((l) => l.type === 'removed').length;
    return { additions, deletions };
  });

  // Highlight code when diff changes
  createEffect(() => {
    const lines = parsedLines();
    const language = detectLanguage(props.fileName);
    const shikiLang = getShikiLanguage(language);

    setIsHighlighting(true);

    (async () => {
      try {
        const highlighter = await getHighlighter();
        const loadedLang = await ensureLanguageLoaded(highlighter, shikiLang);
        const theme = getShikiTheme();

        const highlighted = new Map<number, string>();

        for (const line of lines) {
          if (line.type === 'header') {
            // Don't highlight headers
            highlighted.set(line.lineNumber, line.content);
            continue;
          }

          // Remove diff marker for highlighting
          const codeContent = line.content.startsWith('+') || line.content.startsWith('-') || line.content.startsWith(' ')
            ? line.content.slice(1)
            : line.content;

          try {
            const html = highlighter.codeToHtml(codeContent, {
              lang: loadedLang,
              theme,
            });

            // Extract just the code part (remove pre/code tags)
            const match = html.match(/<code[^>]*>(.*?)<\/code>/s);
            const codeHtml = match ? match[1] : codeContent;

            highlighted.set(line.lineNumber, codeHtml);
          } catch (e) {
            // Fallback to plain text
            highlighted.set(line.lineNumber, codeContent);
          }
        }

        setHighlightedLines(highlighted);
      } catch (error) {
        console.error('Syntax highlighting failed:', error);
      } finally {
        setIsHighlighting(false);
      }
    })();
  });

  const getLineClass = (type: DiffLine['type']): string => {
    switch (type) {
      case 'added':
        return 'bg-green-500/10 border-l-2 border-green-500';
      case 'removed':
        return 'bg-red-500/10 border-l-2 border-red-500';
      case 'header':
        return 'bg-blue-500/10 text-blue-400 font-semibold';
      case 'context':
        return 'text-zed-text-secondary';
    }
  };

  const getLinePrefix = (type: DiffLine['type']): string => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  };

  return (
    <div class="h-full w-full overflow-auto bg-zed-bg-app">
      <Show
        when={props.diff && props.diff.trim().length > 0}
        fallback={
          <div class="flex items-center justify-center h-full text-zed-text-tertiary">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p class="text-sm">No changes in this file</p>
            </div>
          </div>
        }
      >
        {/* Diff Header */}
        <div class="sticky top-0 bg-zed-bg-panel border-b border-zed-border-subtle px-4 py-2 z-10">
          <div class="flex items-center justify-between">
            <div class="text-xs text-zed-text-tertiary">
              Diff View
              <Show when={isHighlighting()}>
                <span class="ml-2 opacity-70">(highlighting...)</span>
              </Show>
            </div>
            <div class="flex items-center gap-3 text-xs font-mono">
              <span class="text-green-400">+{stats().additions}</span>
              <span class="text-red-400">-{stats().deletions}</span>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div class="font-mono text-sm">
          {parsedLines().map((line) => {
            const highlighted = highlightedLines().get(line.lineNumber);

            return (
              <div class={`px-4 py-0.5 ${getLineClass(line.type)} hover:bg-opacity-20 transition-colors flex w-full`}>
                <span class="select-none text-zed-text-tertiary mr-2 inline-block w-10 text-right flex-shrink-0">
                  {line.lineNumber}
                </span>
                <Show
                  when={line.type === 'added' || line.type === 'removed'}
                  fallback={
                    <span class="select-none mr-2 opacity-50 flex-shrink-0">{getLinePrefix(line.type)}</span>
                  }
                >
                  <span class={`select-none mr-2 flex-shrink-0 ${
                    line.type === 'added' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {getLinePrefix(line.type)}
                  </span>
                </Show>
                <Show
                  when={highlighted && line.type !== 'header'}
                  fallback={
                    <span class="whitespace-pre-wrap flex-1 min-w-0 break-all">{line.content}</span>
                  }
                >
                  <span
                    class="whitespace-pre-wrap flex-1 min-w-0 break-all"
                    innerHTML={highlighted || line.content}
                  />
                </Show>
              </div>
            );
          })}
        </div>
      </Show>
    </div>
  );
}
