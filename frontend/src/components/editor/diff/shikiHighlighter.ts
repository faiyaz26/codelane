// Shiki highlighter setup for @git-diff-view
import { getDiffViewHighlighter } from '@git-diff-view/shiki';
import type { BundledLanguage } from 'shiki';
import type { DiffHighlighter } from '@git-diff-view/shiki';

// Common languages we want to support
const SUPPORTED_LANGUAGES: BundledLanguage[] = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'rust',
  'python',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'markdown',
  'bash',
  'shell',
  'sql',
  'xml',
  'dockerfile',
  'toml',
];

let highlighter: DiffHighlighter | null = null;

/**
 * Initialize the Shiki highlighter for diff viewing
 * This should be called once at app startup
 */
export async function initDiffHighlighter(): Promise<DiffHighlighter> {
  if (!highlighter) {
    highlighter = await getDiffViewHighlighter(SUPPORTED_LANGUAGES);
  }
  return highlighter;
}

/**
 * Get the initialized highlighter instance
 * Returns null if not yet initialized
 */
export function getDiffHighlighter(): DiffHighlighter | null {
  return highlighter;
}
