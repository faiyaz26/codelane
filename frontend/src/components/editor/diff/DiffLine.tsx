// DiffLine - renders a single line in the diff view

import { Show } from 'solid-js';
import type { ParsedDiffLine } from './types';

interface DiffLineProps {
  line: ParsedDiffLine;
  highlightedCode?: string;
  isUnified?: boolean; // true for unified view, false for split view
}

export function DiffLine(props: DiffLineProps) {
  const getLineClass = (): string => {
    switch (props.line.type) {
      case 'added':
        return 'bg-green-500/10 border-l-2 border-green-500';
      case 'removed':
        return 'bg-red-500/10 border-l-2 border-red-500';
      case 'header':
        return 'bg-blue-500/10 text-blue-400 font-semibold';
      case 'context':
        return 'text-zed-text-secondary';
    }
  };

  const getLinePrefix = (): string => {
    switch (props.line.type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return ' ';
    }
  };

  const getPrefixColor = (): string => {
    switch (props.line.type) {
      case 'added':
        return 'text-green-400';
      case 'removed':
        return 'text-red-400';
      default:
        return 'opacity-50';
    }
  };

  return (
    <div class={`px-4 py-0.5 ${getLineClass()} hover:bg-opacity-20 transition-colors flex w-full`}>
      {/* Line number (unified view) or old/new line numbers (split view) */}
      <Show when={props.isUnified !== false}>
        <span class="select-none text-zed-text-tertiary mr-2 inline-block w-10 text-right flex-shrink-0">
          {props.line.type === 'header' ? '' : props.line.newLineNumber || props.line.oldLineNumber || ''}
        </span>
      </Show>

      {/* +/- prefix */}
      <span class={`select-none mr-2 flex-shrink-0 ${getPrefixColor()}`}>
        {getLinePrefix()}
      </span>

      {/* Code content */}
      <Show
        when={props.highlightedCode && props.line.type !== 'header'}
        fallback={
          <span class="whitespace-pre-wrap flex-1 min-w-0 break-all">{props.line.content}</span>
        }
      >
        <span
          class="whitespace-pre-wrap flex-1 min-w-0 break-all"
          innerHTML={props.highlightedCode}
        />
      </Show>
    </div>
  );
}
