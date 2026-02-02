// File viewer component - displays file content with Shiki syntax highlighting, code folding, and search

import { createSignal, createEffect, createMemo, For, Show, onMount, onCleanup } from 'solid-js';
import { createHighlighter, type Highlighter, type BundledLanguage } from 'shiki';
import type { OpenFile } from './types';
import { getLanguageDisplayName, getShikiLanguage, isMarkdownFile } from './types';
import { themeManager, getShikiTheme, getAllShikiThemes } from '../../services/ThemeManager';
import { keyboardShortcutManager } from '../../services/KeyboardShortcutManager';
import { editorStateManager } from '../../services/EditorStateManager';
import { MarkdownEditor } from './markdown';

// Singleton highlighter instance
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLanguages = new Set<string>();

// Get or create the highlighter
async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: getAllShikiThemes(),
      langs: [],
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

// ============ FOLDING ============

interface FoldRegion {
  startLine: number;
  endLine: number;
}

const INDENTATION_LANGUAGES = new Set([
  'python', 'yaml', 'yml', 'coffee', 'coffeescript', 'haml', 'slim', 'pug', 'jade'
]);

function detectBracketFoldRegions(content: string): FoldRegion[] {
  const lines = content.split('\n');
  const regions: FoldRegion[] = [];
  const stack: { char: string; line: number }[] = [];

  const openBrackets: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const closeBrackets: Record<string, string> = { '}': '{', ']': '[', ')': '(' };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const prevChar = i > 0 ? line[i - 1] : '';

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
      if (char === '/' && line[i + 1] === '/') break;
      if (char === '#') break;

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

function detectIndentationFoldRegions(content: string): FoldRegion[] {
  const lines = content.split('\n');
  const regions: FoldRegion[] = [];

  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    return match[1].replace(/\t/g, '    ').length;
  };

  const isEmptyOrComment = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//');
  };

  const stack: { indent: number; line: number }[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (isEmptyOrComment(line)) continue;

    const currentIndent = getIndent(line);

    while (stack.length > 0 && stack[stack.length - 1].indent >= currentIndent) {
      const startInfo = stack.pop()!;
      let endLine = lineIdx - 1;
      while (endLine > startInfo.line && isEmptyOrComment(lines[endLine])) {
        endLine--;
      }
      if (endLine > startInfo.line) {
        regions.push({ startLine: startInfo.line, endLine });
      }
    }

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

function detectFoldableRegions(content: string, language: string): FoldRegion[] {
  const normalizedLang = language.toLowerCase();
  let regions: FoldRegion[];

  if (INDENTATION_LANGUAGES.has(normalizedLang)) {
    regions = detectIndentationFoldRegions(content);
  } else {
    regions = detectBracketFoldRegions(content);
  }

  regions.sort((a, b) => a.startLine - b.startLine);
  return regions;
}

// ============ SEARCH ============

interface SearchMatch {
  lineIdx: number;
  startCol: number;
  endCol: number;
  text: string;
}

function findMatches(content: string, query: string, useRegex: boolean, caseSensitive: boolean): SearchMatch[] {
  if (!query) return [];

  const matches: SearchMatch[] = [];
  const lines = content.split('\n');

  try {
    let regex: RegExp;
    if (useRegex) {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      // Escape special regex characters for literal search
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      let match;
      regex.lastIndex = 0; // Reset regex state

      while ((match = regex.exec(line)) !== null) {
        matches.push({
          lineIdx,
          startCol: match.index,
          endCol: match.index + match[0].length,
          text: match[0],
        });

        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
  } catch (e) {
    // Invalid regex - return empty matches
    console.warn('Invalid search regex:', e);
  }

  return matches;
}

// Highlight matches in HTML content
function highlightMatchesInHtml(
  html: string,
  matches: SearchMatch[],
  lineIdx: number,
  currentMatchIdx: number,
  allMatches: SearchMatch[]
): string {
  // Early validation
  if (!html || !matches || matches.length === 0) return html;

  const lineMatches = matches.filter(m => m.lineIdx === lineIdx);
  if (lineMatches.length === 0) return html;

  // We need to work with the text content, not HTML
  // This is a simplified approach - extract text, find positions, wrap with highlights
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const textContent = tempDiv.textContent || '';

  // Validate that matches are within text bounds
  const validMatches = lineMatches.filter(
    m => m.startCol >= 0 && m.startCol < textContent.length && m.endCol <= textContent.length
  );
  if (validMatches.length === 0) return html;

  // Build result by processing character by character
  let result = '';
  let htmlIdx = 0;
  let textIdx = 0;

  // Sort matches by position and remove overlapping matches
  const sortedMatches = [...validMatches].sort((a, b) => a.startCol - b.startCol);

  for (const match of sortedMatches) {
    // Skip if match would overlap with previous match
    if (match.startCol < textIdx) continue;

    // Find the global index of this match
    const globalIdx = allMatches.findIndex(
      m => m.lineIdx === match.lineIdx && m.startCol === match.startCol
    );
    const isCurrent = globalIdx === currentMatchIdx;

    // Advance to match start (with safety limit to prevent infinite loops)
    let safetyCounter = 0;
    const MAX_ITERATIONS = html.length * 2;
    while (textIdx < match.startCol && htmlIdx < html.length && safetyCounter++ < MAX_ITERATIONS) {
      if (html[htmlIdx] === '<') {
        // Skip HTML tag
        const tagEnd = html.indexOf('>', htmlIdx);
        if (tagEnd !== -1) {
          result += html.substring(htmlIdx, tagEnd + 1);
          htmlIdx = tagEnd + 1;
        } else {
          result += html[htmlIdx++];
        }
      } else if (html[htmlIdx] === '&') {
        // Handle HTML entities
        const entityEnd = html.indexOf(';', htmlIdx);
        if (entityEnd !== -1 && entityEnd - htmlIdx < 10) {
          result += html.substring(htmlIdx, entityEnd + 1);
          htmlIdx = entityEnd + 1;
          textIdx++;
        } else {
          result += html[htmlIdx++];
          textIdx++;
        }
      } else {
        result += html[htmlIdx++];
        textIdx++;
      }
    }

    // Add highlight start
    const highlightClass = isCurrent ? 'search-match search-match-current' : 'search-match';
    result += `<span class="${highlightClass}">`;

    // Add match content (with safety limit)
    safetyCounter = 0;
    while (textIdx < match.endCol && htmlIdx < html.length && safetyCounter++ < MAX_ITERATIONS) {
      if (html[htmlIdx] === '<') {
        const tagEnd = html.indexOf('>', htmlIdx);
        if (tagEnd !== -1) {
          result += html.substring(htmlIdx, tagEnd + 1);
          htmlIdx = tagEnd + 1;
        } else {
          result += html[htmlIdx++];
        }
      } else if (html[htmlIdx] === '&') {
        const entityEnd = html.indexOf(';', htmlIdx);
        if (entityEnd !== -1 && entityEnd - htmlIdx < 10) {
          result += html.substring(htmlIdx, entityEnd + 1);
          htmlIdx = entityEnd + 1;
          textIdx++;
        } else {
          result += html[htmlIdx++];
          textIdx++;
        }
      } else {
        result += html[htmlIdx++];
        textIdx++;
      }
    }

    result += '</span>';

    // Check if we hit safety limit
    if (safetyCounter >= MAX_ITERATIONS) {
      console.warn('Highlight loop safety limit reached - possible infinite loop detected');
      return html; // Return original HTML to avoid corrupting display
    }
  }

  // Add remaining content
  if (htmlIdx < html.length) {
    result += html.substring(htmlIdx);
  }

  return result;
}

// Parse Shiki HTML output into lines
function parseShikiHtml(html: string): string[] {
  const lines: string[] = [];

  // Find the code element content
  const codeMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  if (!codeMatch) {
    return html.split('\n');
  }

  const codeContent = codeMatch[1];

  // Shiki wraps each line in <span class="line">...</span>
  // We need to handle nested spans properly, so we use a state machine approach
  let pos = 0;
  const lineStartTag = '<span class="line">';
  const lineEndTag = '</span>';

  while (pos < codeContent.length) {
    const lineStart = codeContent.indexOf(lineStartTag, pos);
    if (lineStart === -1) break;

    const contentStart = lineStart + lineStartTag.length;

    // Find the matching closing </span> by counting nesting
    let depth = 1;
    let searchPos = contentStart;
    let contentEnd = -1;

    while (searchPos < codeContent.length && depth > 0) {
      const nextOpen = codeContent.indexOf('<span', searchPos);
      const nextClose = codeContent.indexOf('</span>', searchPos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Found an opening span before closing
        depth++;
        searchPos = nextOpen + 5; // Move past '<span'
      } else {
        // Found a closing span
        depth--;
        if (depth === 0) {
          contentEnd = nextClose;
        }
        searchPos = nextClose + 7; // Move past '</span>'
      }
    }

    if (contentEnd !== -1) {
      lines.push(codeContent.substring(contentStart, contentEnd));
      pos = contentEnd + lineEndTag.length;
    } else {
      // Fallback: couldn't find matching close, take rest of content
      lines.push(codeContent.substring(contentStart));
      break;
    }
  }

  // Fallback if no lines were found
  if (lines.length === 0) {
    return codeContent.split('\n');
  }

  return lines;
}

// ============ VIRTUALIZATION ============

const LINE_HEIGHT = 20; // pixels per line (matches CSS)
const OVERSCAN = 20; // extra lines to render above/below viewport

// ============ COMPONENT ============

interface FileViewerProps {
  file: OpenFile | null;
  laneId?: string;
}

export function FileViewer(props: FileViewerProps) {
  const [highlightedLines, setHighlightedLines] = createSignal<string[]>([]);
  const [rawLines, setRawLines] = createSignal<string[]>([]);
  const [isHighlighting, setIsHighlighting] = createSignal(false);
  const [foldRegions, setFoldRegions] = createSignal<FoldRegion[]>([]);
  const [foldedLines, setFoldedLines] = createSignal<Set<number>>(new Set());

  // Search state
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [useRegex, setUseRegex] = createSignal(false);
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [currentMatchIdx, setCurrentMatchIdx] = createSignal(0);
  const [searchError, setSearchError] = createSignal<string | null>(null);

  // Virtualization state
  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(600);

  let searchInputRef: HTMLInputElement | undefined;
  let codeContainerRef: HTMLDivElement | undefined;

  // Compute search matches
  const searchMatches = createMemo(() => {
    const content = props.file?.content;
    const query = searchQuery();

    if (!content || !query || !searchOpen()) {
      setSearchError(null);
      return [];
    }

    try {
      if (useRegex()) {
        // Validate regex
        new RegExp(query);
      }
      setSearchError(null);
      return findMatches(content, query, useRegex(), caseSensitive());
    } catch (e) {
      setSearchError('Invalid regex');
      return [];
    }
  });

  // Folding helpers
  const getFoldRegionAt = (lineIdx: number): FoldRegion | undefined => {
    return foldRegions().find(r => r.startLine === lineIdx);
  };

  const isFoldableStart = (lineIdx: number): boolean => {
    return foldRegions().some(r => r.startLine === lineIdx);
  };

  const isLineHidden = (lineIdx: number): boolean => {
    const folded = foldedLines();
    for (const region of foldRegions()) {
      if (folded.has(region.startLine) && lineIdx > region.startLine && lineIdx <= region.endLine) {
        return true;
      }
    }
    return false;
  };

  const isLineFolded = (lineIdx: number): boolean => {
    return foldedLines().has(lineIdx);
  };

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

  const getHiddenLineCount = (lineIdx: number): number => {
    const region = getFoldRegionAt(lineIdx);
    if (!region) return 0;
    return region.endLine - region.startLine;
  };

  // Search navigation
  const goToNextMatch = () => {
    const matches = searchMatches();
    if (matches.length === 0) return;

    const nextIdx = (currentMatchIdx() + 1) % matches.length;
    setCurrentMatchIdx(nextIdx);
    scrollToMatch(matches[nextIdx]);
  };

  const goToPrevMatch = () => {
    const matches = searchMatches();
    if (matches.length === 0) return;

    const prevIdx = (currentMatchIdx() - 1 + matches.length) % matches.length;
    setCurrentMatchIdx(prevIdx);
    scrollToMatch(matches[prevIdx]);
  };

  const scrollToMatch = (match: SearchMatch) => {
    // Unfold the line if it's hidden
    for (const region of foldRegions()) {
      if (foldedLines().has(region.startLine) && match.lineIdx > region.startLine && match.lineIdx <= region.endLine) {
        toggleFold(region.startLine);
      }
    }

    // Find the display index of the line (accounting for hidden lines)
    setTimeout(() => {
      const all = allDisplayableLines();
      const lineData = all.find(l => l.lineIdx === match.lineIdx);

      if (lineData && codeContainerRef) {
        // Calculate scroll position to center the line in viewport
        const targetScrollTop = (lineData.displayIdx * LINE_HEIGHT) - (viewportHeight() / 2) + (LINE_HEIGHT / 2);
        codeContainerRef.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }, 50);
  };

  // Open search
  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef?.focus(), 0);
  };

  // Close search
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setCurrentMatchIdx(0);

    // Clear project search highlights
    if (props.file && props.laneId) {
      editorStateManager.clearHighlight(props.laneId, props.file.id);
    }
  };

  // Keyboard handler for global shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + F to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      openSearch();
      return;
    }

    // Escape to close search (only when search is open)
    if (e.key === 'Escape' && searchOpen()) {
      e.preventDefault();
      closeSearch();
      return;
    }
  };

  // Search input keyboard handler (for Enter/Shift+Enter within the input)
  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  };

  // Register keyboard listener
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Handle scroll for virtualization
  const handleScroll = () => {
    if (codeContainerRef) {
      setScrollTop(codeContainerRef.scrollTop);
    }
  };

  // Update viewport height on mount and resize
  onMount(() => {
    const updateViewportHeight = () => {
      if (codeContainerRef) {
        setViewportHeight(codeContainerRef.clientHeight);
      }
    };

    updateViewportHeight();
    const resizeObserver = new ResizeObserver(updateViewportHeight);
    if (codeContainerRef) {
      resizeObserver.observe(codeContainerRef);
    }

    onCleanup(() => resizeObserver.disconnect());
  });

  // Reset match index when matches change
  createEffect(() => {
    const matches = searchMatches();
    if (matches.length > 0 && currentMatchIdx() >= matches.length) {
      setCurrentMatchIdx(0);
    }
  });

  // Scroll to first match when search query changes
  createEffect(() => {
    const matches = searchMatches();
    if (matches.length > 0 && searchQuery()) {
      setCurrentMatchIdx(0);
      scrollToMatch(matches[0]);
    }
  });

  // Scroll to line from search results
  createEffect(() => {
    // Check highlighting state first (this creates the dependency)
    const highlighting = isHighlighting();

    // Then check file props
    const file = props.file;
    const laneId = props.laneId;

    // Early exit if no file or no scroll target
    if (!file || !laneId) return;
    if (file.isLoading || !file.content) return;
    if (file.scrollToLine === undefined) return;

    // Wait for highlighting to complete before scrolling
    if (highlighting) return;

    // Capture all values needed in the async callback
    const targetLine = file.scrollToLine;
    const fileId = file.id;
    const capturedLaneId = laneId;

    // Find the display index of the line (accounting for hidden/folded lines)
    // scrollToLine is 1-indexed, convert to 0-indexed lineIdx
    const lineIndex = Math.max(0, targetLine - 1);
    const all = allDisplayableLines();
    const lineData = all.find(l => l.lineIdx === lineIndex);

    if (!lineData) {
      // Line not found (might be folded or out of range), clear the scroll target
      editorStateManager.clearScrollToLine(capturedLaneId, fileId);
      return;
    }

    // Scroll with a small delay to ensure DOM is updated
    requestAnimationFrame(() => {
      if (codeContainerRef) {
        // Calculate scroll position to center the line in viewport
        const targetScrollTop = (lineData.displayIdx * LINE_HEIGHT) - (viewportHeight() / 2) + (LINE_HEIGHT / 2);
        codeContainerRef.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }

      // Clear the scroll target after scrolling (use captured values)
      editorStateManager.clearScrollToLine(capturedLaneId, fileId);
    });
  });

  // Highlight code when file content or theme changes
  createEffect(() => {
    const file = props.file;
    const currentTheme = themeManager.getTheme()();

    if (!file || file.isLoading || file.error || file.content === null) {
      setHighlightedLines([]);
      setRawLines([]);
      setFoldRegions([]);
      setFoldedLines(new Set());
      return;
    }

    const content = file.content;
    const language = getShikiLanguage(file.language);
    const shikiTheme = getShikiTheme(currentTheme);

    setRawLines(content.split('\n'));
    setFoldRegions(detectFoldableRegions(content, language));
    setFoldedLines(new Set());

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

  // Calculate all displayable lines (not hidden by folds)
  const allDisplayableLines = createMemo(() => {
    const lines = highlightedLines();
    const result: { lineIdx: number; displayIdx: number; html: string; isFoldStart: boolean; isFolded: boolean }[] = [];

    let displayIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (isLineHidden(i)) continue;

      result.push({
        lineIdx: i,
        displayIdx,
        html: lines[i],
        isFoldStart: isFoldableStart(i),
        isFolded: isLineFolded(i),
      });
      displayIdx++;
    }

    return result;
  });

  // Total height for virtual scroll container
  const totalHeight = createMemo(() => allDisplayableLines().length * LINE_HEIGHT);

  // Calculate visible range based on scroll position
  const visibleRange = createMemo(() => {
    const top = scrollTop();
    const height = viewportHeight();

    const startIdx = Math.max(0, Math.floor(top / LINE_HEIGHT) - OVERSCAN);
    const endIdx = Math.min(
      allDisplayableLines().length,
      Math.ceil((top + height) / LINE_HEIGHT) + OVERSCAN
    );

    return { startIdx, endIdx };
  });

  // Convert project search highlight to SearchMatch format (memoized)
  const projectSearchMatch = createMemo((): SearchMatch | null => {
    const file = props.file;
    const highlight = file?.highlightMatch;

    if (!highlight) return null;

    // Validate match data
    if (highlight.line < 1 || highlight.column < 0 || !highlight.text) {
      console.warn('Invalid highlight match data:', highlight);
      return null;
    }

    // Convert to 0-indexed
    const lineIdx = highlight.line - 1;
    const lines = rawLines();

    // Validate line exists
    if (lineIdx < 0 || lineIdx >= lines.length) {
      console.warn('Highlight line out of bounds:', lineIdx, 'total lines:', lines.length);
      return null;
    }

    const lineContent = lines[lineIdx];
    const startCol = highlight.column;

    // Validate column is within line bounds
    if (startCol < 0 || startCol >= lineContent.length) {
      console.warn('Highlight column out of bounds:', startCol, 'line length:', lineContent.length);
      return null;
    }

    // Calculate end column, clamping to line length
    const endCol = Math.min(startCol + highlight.text.length, lineContent.length);

    return {
      lineIdx,
      startCol,
      endCol,
      text: highlight.text,
    };
  });

  // Create a Set of line indices that have matches for O(1) lookup
  const matchLineIndices = createMemo(() => {
    const indices = new Set<number>();
    const matches = searchMatches();
    const projectMatch = projectSearchMatch();

    for (const match of matches) {
      indices.add(match.lineIdx);
    }

    if (projectMatch) {
      indices.add(projectMatch.lineIdx);
    }

    return indices;
  });

  // Get only the lines in the visible range with search highlighting
  const visibleLines = createMemo(() => {
    const all = allDisplayableLines();
    const { startIdx, endIdx } = visibleRange();
    const matches = searchMatches();
    const matchIdx = currentMatchIdx();
    const projectMatch = projectSearchMatch();
    const matchLines = matchLineIndices();

    return all.slice(startIdx, endIdx).map((line) => {
      let html = line.html;

      // Only apply highlighting if this line has matches (fast check)
      if (matchLines.has(line.lineIdx)) {
        // Apply in-file search highlighting
        if (matches.length > 0) {
          html = highlightMatchesInHtml(html, matches, line.lineIdx, matchIdx, matches);
        }
        // Apply project search highlighting (as current match)
        else if (projectMatch && projectMatch.lineIdx === line.lineIdx) {
          html = highlightMatchesInHtml(html, [projectMatch], line.lineIdx, 0, [projectMatch]);
        }
      }

      return {
        ...line,
        html,
        hasMatch: matchLines.has(line.lineIdx),
      };
    });
  });

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface relative">
      {/* Search bar */}
      <Show when={searchOpen()}>
        <div class="absolute top-0 right-4 z-10 mt-2 flex items-center gap-2 bg-zed-bg-panel border border-zed-border-default rounded-md shadow-lg p-1.5">
          <div class="relative">
            <input
              ref={searchInputRef}
              type="text"
              class="w-64 h-7 px-2 text-sm bg-zed-bg-surface border border-zed-border-default rounded text-zed-text-primary placeholder:text-zed-text-disabled focus:border-zed-accent-blue focus:outline-none"
              classList={{ 'border-zed-accent-red': !!searchError() }}
              placeholder="Search..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck={false}
            />
            <Show when={searchError()}>
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zed-accent-red">
                {searchError()}
              </span>
            </Show>
          </div>

          {/* Match count */}
          <span class="text-xs text-zed-text-tertiary min-w-[60px] text-center">
            <Show when={searchMatches().length > 0} fallback={searchQuery() ? 'No results' : ''}>
              {currentMatchIdx() + 1} of {searchMatches().length}
            </Show>
          </span>

          {/* Navigation buttons */}
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={goToPrevMatch}
            disabled={searchMatches().length === 0}
            title="Previous match (Shift+Enter)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={goToNextMatch}
            disabled={searchMatches().length === 0}
            title="Next match (Enter)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Divider */}
          <div class="w-px h-5 bg-zed-border-default" />

          {/* Toggle buttons */}
          <button
            class="h-6 px-1.5 flex items-center justify-center rounded text-xs font-mono"
            classList={{
              'bg-zed-accent-blue text-white': caseSensitive(),
              'hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary': !caseSensitive(),
            }}
            onClick={() => setCaseSensitive(!caseSensitive())}
            title="Match case"
          >
            Aa
          </button>
          <button
            class="h-6 px-1.5 flex items-center justify-center rounded text-xs font-mono"
            classList={{
              'bg-zed-accent-blue text-white': useRegex(),
              'hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary': !useRegex(),
            }}
            onClick={() => setUseRegex(!useRegex())}
            title="Use regular expression"
          >
            .*
          </button>

          {/* Close button */}
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary"
            onClick={closeSearch}
            title="Close (Escape)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </Show>

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

      {/* Markdown file - use dedicated editor */}
      {/* keyed=true ensures component is recreated if file identity changes */}
      <Show
        when={props.file && !props.file.isLoading && !props.file.error && props.file.content !== null && isMarkdownFile(props.file.name) ? props.file : undefined}
        keyed
      >
        {(file) => <MarkdownEditor file={file} laneId={props.laneId} />}
      </Show>

      {/* Non-markdown file content */}
      <Show when={props.file && !props.file.isLoading && !props.file.error && props.file.content !== null && !isMarkdownFile(props.file.name)}>
        {/* File info bar */}
        <div class="h-7 px-4 border-b border-zed-border-subtle flex items-center justify-end text-xs bg-zed-bg-panel">
          <div class="flex items-center gap-4 text-zed-text-disabled flex-shrink-0">
            <span>{props.file!.content?.split('\n').length || 0} lines</span>
            <button
              class="hover:text-zed-text-primary transition-colors"
              onClick={openSearch}
              title={`Search (${keyboardShortcutManager.formatShortcut({ id: '', description: '', key: 'f', modifiers: { cmdOrCtrl: true }, handler: () => {} })})`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Code view with folding - virtualized */}
        <div class="flex-1 overflow-auto" ref={codeContainerRef} onScroll={handleScroll}>
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
            {/* Virtual scroll container */}
            <div class="shiki-container-custom relative" style={{ height: `${totalHeight()}px` }}>
              <For each={visibleLines()}>
                {(line) => (
                  <div
                    class="code-line group absolute left-0 right-0"
                    classList={{ 'folded': line.isFolded }}
                    data-line={line.lineIdx}
                    style={{ top: `${line.displayIdx * LINE_HEIGHT}px`, height: `${LINE_HEIGHT}px` }}
                  >
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
                            <Show when={line.isFolded} fallback={<path d="M19 9l-7 7-7-7" />}>
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
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
