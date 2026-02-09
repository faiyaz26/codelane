// DiffViewUnified - unified diff view (single column with +/- markers)

import { For } from 'solid-js';
import { DiffHunk } from './DiffHunk';
import type { ParsedDiff, ExpandedContext } from './types';

interface DiffViewUnifiedProps {
  parsedDiff: ParsedDiff;
  highlightedLines: Map<string, string>;
  expandedHunks: Map<number, ExpandedContext>;
  onExpandAbove?: (hunkIndex: number) => void;
  onExpandBelow?: (hunkIndex: number) => void;
}

export function DiffViewUnified(props: DiffViewUnifiedProps) {
  return (
    <div class="font-mono text-sm">
      <For each={props.parsedDiff.hunks}>
        {(hunk, index) => {
          const hunkIndex = index();
          const canExpandAbove = hunk.newStart > 1;
          const nextHunk = props.parsedDiff.hunks[hunkIndex + 1];
          const canExpandBelow = !nextHunk || (hunk.newStart + hunk.newLines < nextHunk.newStart);

          return (
            <DiffHunk
              hunk={hunk}
              hunkIndex={hunkIndex}
              highlightedLines={props.highlightedLines}
              onExpandAbove={props.onExpandAbove}
              onExpandBelow={props.onExpandBelow}
              expandedContext={props.expandedHunks.get(hunkIndex)}
              canExpandAbove={canExpandAbove}
              canExpandBelow={canExpandBelow}
            />
          );
        }}
      </For>
    </div>
  );
}
