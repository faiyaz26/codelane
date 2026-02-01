// File viewer component - displays file content with Shiki syntax highlighting and code folding

import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';
import type { OpenFile } from './types';
import { getLanguageDisplayName, getShikiLanguage } from './types';
import { themeManager, type ThemeId } from '../../services/ThemeManager';

// Singleton highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

// Map app themes to Shiki themes
function getShikiTheme(themeId: ThemeId): string {
  switch (themeId) {
    case 'light':
      return 'github-light-default';
    case 'zed-dark':
      return 'one-dark-pro';
    case 'dark':
    default:
      return 'github-dark-default';
  }
}

// Get or create the highlighter
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark-default', 'github-light-default', 'one-dark-pro'],
      langs: [], // Start with no languages, load on demand
    });
  }
  return highlighterPromise;
}

// Ensure a language is loaded
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

// Foldable region detection
interface FoldRegion {
  startLine: number; // 0-indexed
  endLine: number;   // 0-indexed, inclusive
}

// Languages that use indentation-based folding
const INDENTATION_LANGUAGES = new Set([
  'python', 'yaml', 'yml', 'coffee', 'coffeescript', 'haml', 'slim', 'pug', 'jade'
]);

// Detect foldable regions based on brackets (for C-style languages)
function detectBracketFoldRegions(content: string): FoldRegion[] {
  const lines = content.split('\n');
  const regions: FoldRegion[] = [];
  const stack: { char: string; line: number }[] = [];

  const openBrackets: Record<string, string> = {
    '{': '}',
    '[': ']',
    '(': ')',
  };

  const closeBrackets: Record<string, string> = {
    '}': '{',
    ']': '[',
    ')': '(',
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';

      // Handle string detection (simplified)
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      // Skip line comments
      if (char === '/' && line[i + 1] === '/') break;
      if (char === '#') break; // Python/Ruby comments

      if (openBrackets[char]) {
        stack.push({ char, line: lineIdx });
      } else if (closeBrackets[char]) {
        const expected = closeBrackets[char];
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].char === expected) {
            const startLine = stack[j].line;
            if (lineIdx > startLine) {
              regions.push({ startLine, endLine: lineIdx });
            }
            stack.splice(j, 1);
            break;
          }
        }
      }
    }
  }

  return regions;
}

// Detect foldable regions based on indentation (for Python, YAML, etc.)
function detectIndentationFoldRegions(content: string): FoldRegion[] {
  const lines = content.split('\n');
  const regions: FoldRegion[] = [];

  // Get indentation level of a line (number of leading spaces/tabs)
  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    // Convert tabs to 4 spaces for consistency
    return match[1].replace(/\t/g, '    ').length;
  };

  // Check if line is empty or only whitespace/comments
  const isEmptyOrComment = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//');
  };

  // Stack to track fold start points
  const stack: { indent: number; line: number }[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Skip empty lines and comments for indent calculation
    if (isEmptyOrComment(line)) continue;

    const currentIndent = getIndent(line);

    // Close all regions that have higher or equal indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= currentIndent) {
      const startInfo = stack.pop()!;
      // Find the last non-empty line before current
      let endLine = lineIdx - 1;
      while (endLine > startInfo.line && isEmptyOrComment(lines[endLine])) {
        endLine--;
      }
      if (endLine > startInfo.line) {
        regions.push({ startLine: startInfo.line, endLine });
      }
    }

    // Check if next non-empty line has higher indentation (start of fold)
    let nextNonEmptyIdx = lineIdx + 1;
    while (nextNonEmptyIdx < lines.length && isEmptyOrComment(lines[nextNonEmptyIdx])) {
      nextNonEmptyIdx++;
    }

    if (nextNonEmptyIdx < lines.length) {
      const nextIndent = getIndent(lines[nextNonEmptyIdx]);
      if (nextIndent > currentIndent) {
        stack.push({ indent: currentIndent, line: lineIdx });
      }
    }
  }

  // Close any remaining open regions
  while (stack.length > 0) {
    const startInfo = stack.pop()!;
    let endLine = lines.length - 1;
    while (endLine > startInfo.line && isEmptyOrComment(lines[endLine])) {
      endLine--;
    }
    if (endLine > startInfo.line) {
      regions.push({ startLine: startInfo.line, endLine });
    }
  }

  return regions;
}

// Main function to detect foldable regions based on language
function detectFoldableRegions(content: string, language: string): FoldRegion[] {
  const normalizedLang = language.toLowerCase();

  let regions: FoldRegion[];

  if (INDENTATION_LANGUAGES.has(normalizedLang)) {
    // Use indentation-based folding for Python, YAML, etc.
    regions = detectIndentationFoldRegions(content);
  } else {
    // Use bracket-based folding for C-style languages
    regions = detectBracketFoldRegions(content);
  }

  // Sort by start line
  regions.sort((a, b) => a.startLine - b.startLine);

  return regions;
}

// Parse Shiki HTML output into lines
function parseShikiHtml(html: string): string[] {
  // Extract lines from Shiki output
  const lineRegex = /<span class="line">(.*?)<\/span>/g;
  const lines: string[] = [];
  let match;

  while ((match = lineRegex.exec(html)) !== null) {
    lines.push(match[1]);
  }

  // If no lines found, try alternative parsing
  if (lines.length === 0) {
    const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    if (codeMatch) {
      // Split by newlines if it's plain content
      return codeMatch[1].split('\n');
    }
  }

  return lines;
}

interface FileViewerProps {
  file: OpenFile | null;
}

export function FileViewer(props: FileViewerProps) {
  const [highlightedLines, setHighlightedLines] = createSignal<string[]>([]);
  const [isHighlighting, setIsHighlighting] = createSignal(false);
  const [foldRegions, setFoldRegions] = createSignal<FoldRegion[]>([]);
  const [foldedLines, setFoldedLines] = createSignal<Set<number>>(new Set());

  // Get fold region starting at a line
  const getFoldRegionAt = (lineIdx: number): FoldRegion | undefined => {
    return foldRegions().find(r => r.startLine === lineIdx);
  };

  // Check if a line is the start of a foldable region
  const isFoldableStart = (lineIdx: number): boolean => {
    return foldRegions().some(r => r.startLine === lineIdx);
  };

  // Check if a line is currently hidden due to folding
  const isLineHidden = (lineIdx: number): boolean => {
    const folded = foldedLines();
    for (const region of foldRegions()) {
      if (folded.has(region.startLine) && lineIdx > region.startLine && lineIdx <= region.endLine) {
        return true;
      }
    }
    return false;
  };

  // Check if a line is folded (the fold start line itself)
  const isLineFolded = (lineIdx: number): boolean => {
    return foldedLines().has(lineIdx);
  };

  // Toggle fold at line
  const toggleFold = (lineIdx: number) => {
    setFoldedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineIdx)) {
        newSet.delete(lineIdx);
      } else {
        newSet.add(lineIdx);
      }
      return newSet;
    });
  };

  // Highlight code when file content or theme changes
  createEffect(() => {
    const file = props.file;
    const currentTheme = themeManager.getTheme()();

    if (!file || file.isLoading || file.error || file.content === null) {
      setHighlightedLines([]);
      setFoldRegions([]);
      setFoldedLines(new Set());
      return;
    }

    const content = file.content;
    const language = getShikiLanguage(file.language);
    const shikiTheme = getShikiTheme(currentTheme);

    // Detect foldable regions based on language type
    setFoldRegions(detectFoldableRegions(content, language));
    setFoldedLines(new Set()); // Reset folds when file changes

    setIsHighlighting(true);

    (async () => {
      try {
        const highlighter = await getHighlighter();
        const loadedLang = await ensureLanguageLoaded(highlighter, language);

        const html = highlighter.codeToHtml(content, {
          lang: loadedLang,
          theme: shikiTheme,
        });

        const lines = parseShikiHtml(html);
        setHighlightedLines(lines);
      } catch (err) {
        console.error('Highlighting failed:', err);
        // Fallback to plain text
        const escaped = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setHighlightedLines(escaped.split('\n'));
      } finally {
        setIsHighlighting(false);
      }
    })();
  });

  // Calculate visible lines with fold info
  const visibleLines = createMemo(() => {
    const lines = highlightedLines();
    const result: { lineIdx: number; html: string; isFoldStart: boolean; isFolded: boolean }[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (isLineHidden(i)) continue;

      result.push({
        lineIdx: i,
        html: lines[i],
        isFoldStart: isFoldableStart(i),
        isFolded: isLineFolded(i),
      });
    }

    return result;
  });

  // Get the number of hidden lines for a folded region
  const getHiddenLineCount = (lineIdx: number): number => {
    const region = getFoldRegionAt(lineIdx);
    if (!region) return 0;
    return region.endLine - region.startLine;
  };

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

        {/* Code view with folding */}
        <div class="flex-1 overflow-auto">
          <Show
            when={!isHighlighting() && highlightedLines().length > 0}
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
            <pre class="shiki-container-custom">
              <code>
                <For each={visibleLines()}>
                  {(line) => (
                    <div class="code-line group" classList={{ 'folded': line.isFolded }}>
                      {/* Fold gutter */}
                      <span class="fold-gutter">
                        <Show when={line.isFoldStart}>
                          <button
                            class="fold-button"
                            classList={{ 'is-folded': line.isFolded }}
                            onClick={() => toggleFold(line.lineIdx)}
                            title={line.isFolded ? 'Expand' : 'Collapse'}
                          >
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <Show when={line.isFolded} fallback={
                                <path d="M19 9l-7 7-7-7" />
                              }>
                                <path d="M9 5l7 7-7 7" />
                              </Show>
                            </svg>
                          </button>
                        </Show>
                      </span>
                      {/* Line number */}
                      <span class="line-number">{line.lineIdx + 1}</span>
                      {/* Line content */}
                      <span class="line-content" innerHTML={line.html} />
                      {/* Fold indicator */}
                      <Show when={line.isFolded}>
                        <span class="fold-indicator">
                          ⋯ {getHiddenLineCount(line.lineIdx)} lines
                        </span>
                      </Show>
                    </div>
                  )}
                </For>
              </code>
            </pre>
          </Show>
        </div>
      </Show>
    </div>
  );
}
