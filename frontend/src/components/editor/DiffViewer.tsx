// DiffViewer - main orchestrator for diff viewing with syntax highlighting

import { createMemo, createSignal, createEffect, Show } from 'solid-js';
import { detectLanguage, getShikiLanguage } from './types';
import { parseDiff } from './diff/DiffParser';
import { highlightDiff, highlightLines } from './diff/DiffHighlighter';
import { fetchExpandedContextAbove, fetchExpandedContextBelow } from './diff/DiffExpansion';
import { DiffViewUnified } from './diff/DiffViewUnified';
import { DiffViewSplit } from './diff/DiffViewSplit';
import type { DiffViewMode, ExpandedContext } from './diff/types';

interface DiffViewerProps {
  diff: string;
  fileName: string;
  filePath?: string; // Relative path for git operations
  workingDir?: string; // Working directory for git commands
}

export function DiffViewer(props: DiffViewerProps) {
  const [highlightedLines, setHighlightedLines] = createSignal<Map<string, string>>(new Map());
  const [isHighlighting, setIsHighlighting] = createSignal(true);
  const [viewMode, setViewMode] = createSignal<DiffViewMode>('unified');
  const [expandedHunks, setExpandedHunks] = createSignal<Map<number, ExpandedContext>>(new Map());

  // Parse diff into structured data
  const parsedDiff = createMemo(() => parseDiff(props.diff));

  // Highlight code when diff changes
  createEffect(() => {
    const diff = parsedDiff();
    const language = detectLanguage(props.fileName);
    const shikiLang = getShikiLanguage(language);

    setIsHighlighting(true);

    (async () => {
      try {
        const highlighted = await highlightDiff(diff, shikiLang);
        setHighlightedLines(highlighted);
      } catch (error) {
        console.error('Syntax highlighting failed:', error);
      } finally {
        setIsHighlighting(false);
      }
    })();
  });

  // Handle expand above button click
  const handleExpandAbove = async (hunkIndex: number) => {
    if (!props.workingDir || !props.filePath) {
      console.warn('Cannot expand: missing workingDir or filePath');
      return;
    }

    const diff = parsedDiff();
    const hunk = diff.hunks[hunkIndex];
    if (!hunk) return;

    const expanded = expandedHunks();
    const currentExpanded = expanded.get(hunkIndex);
    const currentlyExpandedAbove = currentExpanded?.above?.lines.length || 0;

    const context = await fetchExpandedContextAbove(
      props.workingDir,
      props.filePath,
      hunk,
      currentlyExpandedAbove
    );

    if (context) {
      // Highlight the expanded lines
      const language = detectLanguage(props.fileName);
      const shikiLang = getShikiLanguage(language);
      const highlightedLinesArray = await highlightLines(context.lines, shikiLang);

      const newExpanded = new Map(expanded);
      const existing = newExpanded.get(hunkIndex) || {};
      newExpanded.set(hunkIndex, {
        ...existing,
        above: {
          ...context,
          highlightedLines: highlightedLinesArray,
        },
      });
      setExpandedHunks(newExpanded);
    }
  };

  // Handle expand below button click
  const handleExpandBelow = async (hunkIndex: number) => {
    if (!props.workingDir || !props.filePath) {
      console.warn('Cannot expand: missing workingDir or filePath');
      return;
    }

    const diff = parsedDiff();
    const hunk = diff.hunks[hunkIndex];
    if (!hunk) return;

    const expanded = expandedHunks();
    const currentExpanded = expanded.get(hunkIndex);
    const currentlyExpandedBelow = currentExpanded?.below?.lines.length || 0;
    const nextHunk = diff.hunks[hunkIndex + 1];

    const context = await fetchExpandedContextBelow(
      props.workingDir,
      props.filePath,
      hunk,
      currentlyExpandedBelow,
      nextHunk
    );

    if (context) {
      // Highlight the expanded lines
      const language = detectLanguage(props.fileName);
      const shikiLang = getShikiLanguage(language);
      const highlightedLinesArray = await highlightLines(context.lines, shikiLang);

      const newExpanded = new Map(expanded);
      const existing = newExpanded.get(hunkIndex) || {};
      newExpanded.set(hunkIndex, {
        ...existing,
        below: {
          ...context,
          highlightedLines: highlightedLinesArray,
        },
      });
      setExpandedHunks(newExpanded);
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
            {/* View mode tabs */}
            <div class="flex items-center gap-1">
              <button
                onClick={() => setViewMode('unified')}
                class={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode() === 'unified'
                    ? 'bg-zed-bg-hover text-zed-text-primary'
                    : 'text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover/50'
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                class={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode() === 'split'
                    ? 'bg-zed-bg-hover text-zed-text-primary'
                    : 'text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover/50'
                }`}
              >
                Split
              </button>
              <Show when={isHighlighting()}>
                <span class="ml-2 text-xs text-zed-text-tertiary opacity-70">(highlighting...)</span>
              </Show>
            </div>

            {/* Stats */}
            <div class="flex items-center gap-3 text-xs font-mono">
              <span class="text-green-400">+{parsedDiff().additions}</span>
              <span class="text-red-400">-{parsedDiff().deletions}</span>
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <Show
          when={viewMode() === 'unified'}
          fallback={
            /* Split View */
            <DiffViewSplit
              parsedDiff={parsedDiff()}
              highlightedLines={highlightedLines()}
              expandedHunks={expandedHunks()}
              onExpandAbove={handleExpandAbove}
              onExpandBelow={handleExpandBelow}
            />
          }
        >
          {/* Unified View */}
          <DiffViewUnified
            parsedDiff={parsedDiff()}
            highlightedLines={highlightedLines()}
            expandedHunks={expandedHunks()}
            onExpandAbove={handleExpandAbove}
            onExpandBelow={handleExpandBelow}
          />
        </Show>
      </Show>
    </div>
  );
}
