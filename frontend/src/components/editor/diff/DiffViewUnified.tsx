// DiffViewUnified - unified diff view (single column with +/- markers)

import { For } from 'solid-js';
import { DiffHunk } from './DiffHunk';
import type { ParsedDiff, ExpandedContext } from './types';

interface DiffViewUnifiedProps {
  parsedDiff: ParsedDiff;
  highlightedLines: Map<string, string>;
  expandedHunks: Map<number, ExpandedContext>;
  onExpand?: (hunkIndex: number) => void;
}

export function DiffViewUnified(props: DiffViewUnifiedProps) {
  return (
    <div class="font-mono text-sm">
      <For each={props.parsedDiff.hunks}>
        {(hunk, index) => {
          const hunkIndex = index();
          const canExpandAbove = hunkIndex > 0 || hunk.newStart > 1;

          return (
            <DiffHunk
              hunk={hunk}
              hunkIndex={hunkIndex}
              highlightedLines={props.highlightedLines}
              onExpand={props.onExpand}
              expandedContext={props.expandedHunks.get(hunkIndex)}
              canExpandAbove={canExpandAbove}
            />
          );
        }}
      </For>
    </div>
  );
}
