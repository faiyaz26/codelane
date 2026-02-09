// DiffHunk - renders a single hunk with optional expansion

import { createSignal, Show, For } from 'solid-js';
import { DiffLine } from './DiffLine';
import type { DiffHunk as DiffHunkType } from './types';

interface DiffHunkProps {
  hunk: DiffHunkType;
  hunkIndex: number;
  highlightedLines: Map<string, string>;
  onExpand?: (hunkIndex: number) => void;
  expandedContext?: { lines: string[]; startLineNum: number };
  canExpandAbove?: boolean;
}

export function DiffHunk(props: DiffHunkProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const handleExpandClick = () => {
    if (props.onExpand) {
      props.onExpand(props.hunkIndex);
      setIsExpanded(!isExpanded());
    }
  };

  return (
    <>
      {/* Expand button above hunk */}
      <Show when={props.canExpandAbove}>
        <Show
          when={!isExpanded() || !props.expandedContext}
          fallback={
            /* Expanded content */
            <div class="bg-zed-bg-hover/20 border-y border-zed-border-subtle">
              <button
                class="w-full px-4 py-1 text-xs text-zed-text-tertiary hover:text-zed-text-secondary transition-colors flex items-center gap-2"
                onClick={handleExpandClick}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
                <span>Collapse</span>
              </button>
              {/* Show expanded lines */}
              <Show when={props.expandedContext}>
                <For each={props.expandedContext!.lines}>
                  {(lineContent, idx) => {
                    const lineNum = props.expandedContext!.startLineNum + idx();
                    return (
                      <div class="px-4 py-0.5 flex w-full text-zed-text-secondary">
                        <span class="select-none text-zed-text-tertiary mr-2 inline-block w-10 text-right flex-shrink-0 opacity-50">
                          {lineNum}
                        </span>
                        <span class="select-none mr-2 opacity-50 flex-shrink-0"> </span>
                        <span class="whitespace-pre-wrap flex-1 min-w-0 break-all opacity-70">
                          {lineContent}
                        </span>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </div>
          }
        >
          <button
            class="w-full px-4 py-1 text-xs text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover transition-colors flex items-center gap-2"
            onClick={handleExpandClick}
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>Expand above...</span>
          </button>
        </Show>
      </Show>

      {/* Hunk lines */}
      <For each={props.hunk.lines}>
        {(line) => {
          // Create unique key for highlighted content lookup
          const lineKey = `${props.hunkIndex}-${line.newLineNumber || line.oldLineNumber || 0}`;
          const highlighted = props.highlightedLines.get(lineKey);

          return <DiffLine line={line} highlightedCode={highlighted} isUnified={true} />;
        }}
      </For>
    </>
  );
}
