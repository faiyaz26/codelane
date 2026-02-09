// DiffViewSplit - split diff view (two columns: old vs new)
// Following GitHub Desktop's pattern: full-width hunk headers

import { For, Show } from 'solid-js';
import { extractCodeContent } from './DiffParser';
import { LINES_PER_EXPANSION } from './DiffExpansion';
import type { ParsedDiff, ExpandedContext } from './types';

interface SplitLine {
  old: { content: string; lineNumber?: number; exists: boolean };
  new: { content: string; lineNumber?: number; exists: boolean };
  type: 'added' | 'removed' | 'modified' | 'context';
}

interface DiffViewSplitProps {
  parsedDiff: ParsedDiff;
  highlightedLines?: Map<string, string>;
  expandedHunks?: Map<number, ExpandedContext>;
  onExpandAbove?: (hunkIndex: number) => void;
  onExpandBelow?: (hunkIndex: number) => void;
}

export function DiffViewSplit(props: DiffViewSplitProps) {
  // Convert hunk lines to split lines (pair up old/new)
  const hunkToSplitLines = (hunkLines: any[]): SplitLine[] => {
    const result: SplitLine[] = [];

    for (const line of hunkLines) {
      // Skip header lines - they're rendered separately
      if (line.type === 'header') continue;

      if (line.type === 'removed') {
        result.push({
          old: {
            content: extractCodeContent(line.content),
            lineNumber: line.oldLineNumber,
            exists: true,
          },
          new: { content: '', exists: false },
          type: 'removed',
        });
      } else if (line.type === 'added') {
        result.push({
          old: { content: '', exists: false },
          new: {
            content: extractCodeContent(line.content),
            lineNumber: line.newLineNumber,
            exists: true,
          },
          type: 'added',
        });
      } else {
        // context line
        const codeContent = extractCodeContent(line.content);
        result.push({
          old: {
            content: codeContent,
            lineNumber: line.oldLineNumber,
            exists: true,
          },
          new: {
            content: codeContent,
            lineNumber: line.newLineNumber,
            exists: true,
          },
          type: 'context',
        });
      }
    }

    return result;
  };

  const renderLine = (line: SplitLine, side: 'old' | 'new', hunkIndex: number) => {
    const data = side === 'old' ? line.old : line.new;
    const bgClass =
      line.type === 'removed' && side === 'old'
        ? 'bg-red-500/10'
        : line.type === 'added' && side === 'new'
          ? 'bg-green-500/10'
          : '';

    const marker =
      side === 'old' && line.type === 'removed'
        ? '-'
        : side === 'new' && line.type === 'added'
          ? '+'
          : ' ';

    const markerColor = side === 'old' ? 'text-red-400' : 'text-green-400';

    // Get highlighted code if available
    const lineKey = `${hunkIndex}-${data.lineNumber || 0}`;
    const highlighted = props.highlightedLines?.get(lineKey);

    return (
      <div class={`px-3 py-0.5 flex w-full ${bgClass}`}>
        <span class="select-none text-zed-text-tertiary mr-2 inline-block w-8 text-right flex-shrink-0">
          {data.exists ? data.lineNumber : ''}
        </span>
        <span class={`select-none mr-2 w-4 min-w-4 max-w-4 inline-block text-center overflow-hidden flex-shrink-0 ${markerColor}`}>
          {marker}
        </span>
        <Show
          when={highlighted}
          fallback={
            <span class="whitespace-pre-wrap flex-1 min-w-0 break-all">
              {data.exists ? data.content : ''}
            </span>
          }
        >
          <span class="whitespace-pre-wrap flex-1 min-w-0 break-all" innerHTML={highlighted} />
        </Show>
      </div>
    );
  };

  const renderExpandedLines = (
    lines: string[],
    highlightedLines: string[] | undefined,
    startLineNum: number
  ) => {
    return (
      <For each={lines}>
        {(lineContent, idx) => {
          const lineNum = startLineNum + idx();
          const highlighted = highlightedLines?.[idx()];
          return (
            <div class="px-3 py-0.5 flex w-full text-zed-text-secondary">
              <span class="select-none text-zed-text-tertiary mr-2 inline-block w-8 text-right flex-shrink-0 opacity-50">
                {lineNum}
              </span>
              <span class="select-none mr-2 w-4 min-w-4 max-w-4 inline-block text-center overflow-hidden flex-shrink-0 opacity-50"> </span>
              <Show
                when={highlighted}
                fallback={
                  <span class="whitespace-pre-wrap flex-1 min-w-0 break-all opacity-70">
                    {lineContent}
                  </span>
                }
              >
                <span class="whitespace-pre-wrap flex-1 min-w-0 break-all opacity-70" innerHTML={highlighted} />
              </Show>
            </div>
          );
        }}
      </For>
    );
  };

  return (
    <div class="font-mono text-sm">
      <For each={props.parsedDiff.hunks}>
        {(hunk, index) => {
          const hunkIndex = index();
          const canExpandAbove = hunk.newStart > 1;
          const nextHunk = props.parsedDiff.hunks[hunkIndex + 1];
          const canExpandBelow = !nextHunk || (hunk.newStart + hunk.newLines < nextHunk.newStart);
          const expandedContext = props.expandedHunks?.get(hunkIndex);
          const splitLines = hunkToSplitLines(hunk.lines);

          return (
            <>
              {/* Expand button above hunk */}
              <Show when={canExpandAbove || expandedContext?.above}>
                <div class="bg-zed-bg-hover/20 border-y border-zed-border-subtle col-span-2 grid grid-cols-2 divide-x divide-zed-border-subtle">
                  <For each={['old', 'new'] as const}>
                    {() => (
                      <div>
                        {/* Show expanded lines above */}
                        <Show when={expandedContext?.above}>
                          {renderExpandedLines(
                            expandedContext!.above!.lines,
                            expandedContext!.above!.highlightedLines,
                            expandedContext!.above!.startLineNum
                          )}
                        </Show>

                        {/* Expand button - GitHub style */}
                        <Show when={expandedContext?.above?.canExpandMore || (!expandedContext?.above && canExpandAbove)}>
                          <button
                            class="w-full py-1.5 text-xs text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover transition-colors flex items-center justify-center gap-1.5 group"
                            onClick={() => props.onExpandAbove?.(hunkIndex)}
                            title={`Expand ${LINES_PER_EXPANSION} lines above`}
                          >
                            <svg class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                            </svg>
                            <svg class="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />
                            </svg>
                          </button>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              {/* Hunk header - full width (GitHub Desktop style) */}
              <div class="bg-blue-500/10 text-blue-400 font-semibold px-3 py-0.5">
                {hunk.header}
              </div>

              {/* Hunk content - side by side */}
              <div class="grid grid-cols-2 divide-x divide-zed-border-subtle">
                {/* Old (Left) */}
                <div>
                  <For each={splitLines}>
                    {(line) => renderLine(line, 'old', hunkIndex)}
                  </For>
                </div>

                {/* New (Right) */}
                <div>
                  <For each={splitLines}>
                    {(line) => renderLine(line, 'new', hunkIndex)}
                  </For>
                </div>
              </div>

              {/* Expand button below hunk */}
              <Show when={canExpandBelow || expandedContext?.below}>
                <div class="bg-zed-bg-hover/20 border-y border-zed-border-subtle col-span-2 grid grid-cols-2 divide-x divide-zed-border-subtle">
                  <For each={['old', 'new'] as const}>
                    {() => (
                      <div>
                        {/* Expand button - GitHub style */}
                        <Show when={expandedContext?.below?.canExpandMore || (!expandedContext?.below && canExpandBelow)}>
                          <button
                            class="w-full py-1.5 text-xs text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover transition-colors flex items-center justify-center gap-1.5 group"
                            onClick={() => props.onExpandBelow?.(hunkIndex)}
                            title={`Expand ${LINES_PER_EXPANSION} lines below`}
                          >
                            <svg class="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />
                            </svg>
                            <svg class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </Show>

                        {/* Show expanded lines below */}
                        <Show when={expandedContext?.below}>
                          {renderExpandedLines(
                            expandedContext!.below!.lines,
                            expandedContext!.below!.highlightedLines,
                            expandedContext!.below!.startLineNum
                          )}
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </>
          );
        }}
      </For>
    </div>
  );
}
