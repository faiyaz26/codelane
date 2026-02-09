// DiffHighlighter - syntax highlighting service for diff lines

import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';
import { getShikiTheme } from '../../../services/ThemeManager';
import { extractCodeContent } from './DiffParser';
import type { ParsedDiff } from './types';

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

const VALID_LANGS = [
  'javascript',
  'jsx',
  'typescript',
  'tsx',
  'html',
  'css',
  'scss',
  'sass',
  'less',
  'json',
  'yaml',
  'xml',
  'toml',
  'rust',
  'python',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'shellscript',
  'markdown',
  'sql',
  'dockerfile',
  'makefile',
  'cmake',
  'dotenv',
  'text',
] as const;

async function ensureLanguageLoaded(highlighter: Highlighter, lang: string): Promise<string> {
  const targetLang = VALID_LANGS.includes(lang as any) ? lang : 'text';

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

/**
 * Highlight all lines in a parsed diff
 * Returns a map of line keys to highlighted HTML
 */
export async function highlightDiff(
  parsedDiff: ParsedDiff,
  shikiLanguage: string
): Promise<Map<string, string>> {
  const highlighted = new Map<string, string>();

  try {
    const highlighter = await getHighlighter();
    const loadedLang = await ensureLanguageLoaded(highlighter, shikiLanguage);
    const theme = getShikiTheme();

    for (let hunkIndex = 0; hunkIndex < parsedDiff.hunks.length; hunkIndex++) {
      const hunk = parsedDiff.hunks[hunkIndex];

      for (const line of hunk.lines) {
        if (line.type === 'header') {
          // Don't highlight headers
          const lineKey = `${hunkIndex}-${line.newLineNumber || line.oldLineNumber || 0}`;
          highlighted.set(lineKey, line.content);
          continue;
        }

        // Extract code content (remove diff markers)
        const codeContent = extractCodeContent(line.content);

        try {
          const html = highlighter.codeToHtml(codeContent, {
            lang: loadedLang,
            theme,
          });

          // Extract just the code part (remove pre/code tags)
          const match = html.match(/<code[^>]*>(.*?)<\/code>/s);
          const codeHtml = match ? match[1] : codeContent;

          const lineKey = `${hunkIndex}-${line.newLineNumber || line.oldLineNumber || 0}`;
          highlighted.set(lineKey, codeHtml);
        } catch (e) {
          // Fallback to plain text
          const lineKey = `${hunkIndex}-${line.newLineNumber || line.oldLineNumber || 0}`;
          highlighted.set(lineKey, codeContent);
        }
      }
    }
  } catch (error) {
    console.error('Syntax highlighting failed:', error);
  }

  return highlighted;
}
