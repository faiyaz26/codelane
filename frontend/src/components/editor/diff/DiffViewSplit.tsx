// DiffViewSplit - split diff view (two columns: old vs new)

import { For } from 'solid-js';
import type { ParsedDiff } from './types';

interface SplitLine {
  old: { content: string; lineNumber?: number; exists: boolean };
  new: { content: string; lineNumber?: number; exists: boolean };
  type: 'added' | 'removed' | 'modified' | 'context' | 'header';
}

interface DiffViewSplitProps {
  parsedDiff: ParsedDiff;
}

export function DiffViewSplit(props: DiffViewSplitProps) {
  // Convert hunks to split lines (pair up old/new)
  const splitLines = (): SplitLine[] => {
    const result: SplitLine[] = [];

    for (const hunk of props.parsedDiff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'header') {
          result.push({
            old: { content: line.content, exists: true },
            new: { content: line.content, exists: true },
            type: 'header',
          });
        } else if (line.type === 'removed') {
          result.push({
            old: {
              content: line.content,
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
              content: line.content,
              lineNumber: line.newLineNumber,
              exists: true,
            },
            type: 'added',
          });
        } else {
          // context line
          result.push({
            old: {
              content: line.content,
              lineNumber: line.oldLineNumber,
              exists: true,
            },
            new: {
              content: line.content,
              lineNumber: line.newLineNumber,
              exists: true,
            },
            type: 'context',
          });
        }
      }
    }

    return result;
  };

  return (
    <div class="font-mono text-sm grid grid-cols-2 divide-x divide-zed-border-subtle">
      {/* Old (Left) */}
      <div>
        <For each={splitLines()}>
          {(line) => {
            const bgClass =
              line.type === 'removed'
                ? 'bg-red-500/10'
                : line.type === 'header'
                  ? 'bg-blue-500/10'
                  : '';

            return (
              <div class={`px-3 py-0.5 flex w-full ${bgClass}`}>
                <span class="select-none text-zed-text-tertiary mr-2 inline-block w-8 text-right flex-shrink-0">
                  {line.old.exists && line.type !== 'header' ? line.old.lineNumber : ''}
                </span>
                <span class="select-none mr-2 w-4 flex-shrink-0 text-red-400">
                  {line.type === 'removed' ? '-' : ' '}
                </span>
                <span class="whitespace-pre-wrap flex-1 min-w-0 break-all">
                  {line.old.exists ? line.old.content : ''}
                </span>
              </div>
            );
          }}
        </For>
      </div>

      {/* New (Right) */}
      <div>
        <For each={splitLines()}>
          {(line) => {
            const bgClass =
              line.type === 'added'
                ? 'bg-green-500/10'
                : line.type === 'header'
                  ? 'bg-blue-500/10'
                  : '';

            return (
              <div class={`px-3 py-0.5 flex w-full ${bgClass}`}>
                <span class="select-none text-zed-text-tertiary mr-2 inline-block w-8 text-right flex-shrink-0">
                  {line.new.exists && line.type !== 'header' ? line.new.lineNumber : ''}
                </span>
                <span class="select-none mr-2 w-4 flex-shrink-0 text-green-400">
                  {line.type === 'added' ? '+' : ' '}
                </span>
                <span class="whitespace-pre-wrap flex-1 min-w-0 break-all">
                  {line.new.exists ? line.new.content : ''}
                </span>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
