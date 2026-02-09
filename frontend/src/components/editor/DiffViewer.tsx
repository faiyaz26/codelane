// DiffViewer using @git-diff-view with Shiki highlighting
import { createSignal, createMemo, Show, onMount } from 'solid-js';
import { DiffView, DiffModeEnum } from '@git-diff-view/solid';
import { initDiffHighlighter, getDiffHighlighter } from './diff/shikiHighlighter';
import { detectLanguage } from './types';
import type { DiffViewMode } from './diff/types';

// Import styles
import '@git-diff-view/solid/styles/diff-view.css';

interface DiffViewerProps {
  diff: string;
  fileName: string;
  filePath?: string;
  workingDir?: string;
}

export function DiffViewer(props: DiffViewerProps) {
  const [highlighterReady, setHighlighterReady] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<DiffViewMode>('unified');

  // Initialize highlighter on mount
  onMount(async () => {
    await initDiffHighlighter();
    setHighlighterReady(true);
  });

  // Build the data object for DiffView
  const diffData = createMemo(() => {
    const diffText = props.diff;
    if (!diffText || diffText.trim().length === 0) return null;

    const language = detectLanguage(props.fileName);

    return {
      oldFile: { fileName: props.fileName, fileLang: language, content: '' },
      newFile: { fileName: props.fileName, fileLang: language, content: '' },
      hunks: [diffText],
    };
  });

  const highlighter = createMemo(() => {
    if (!highlighterReady()) return undefined;
    return getDiffHighlighter() ?? undefined;
  });

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
              <Show when={!highlighterReady()}>
                <span class="ml-2 text-xs text-zed-text-tertiary opacity-70">(initializing...)</span>
              </Show>
            </div>
          </div>
        </div>

        {/* Diff Content - use data prop so component handles all initialization */}
        <Show when={diffData()}>
          {(data) => (
            <DiffView
              data={data()}
              registerHighlighter={highlighter()}
              diffViewMode={viewMode() === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified}
              diffViewWrap={true}
              diffViewHighlight={highlighterReady()}
              diffViewTheme="dark"
              diffViewFontSize={14}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
