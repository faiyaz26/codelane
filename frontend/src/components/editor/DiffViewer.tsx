// DiffViewer using @git-diff-view with Shiki highlighting
import { createSignal, createEffect, Show, onMount } from 'solid-js';
import { DiffView, DiffModeEnum } from '@git-diff-view/solid';
import { invoke } from '@tauri-apps/api/core';
import { initDiffHighlighter, getDiffHighlighter } from './diff/shikiHighlighter';
import { getFileAtRevision } from '../../lib/git-api';
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
  const [oldContent, setOldContent] = createSignal('');
  const [newContent, setNewContent] = createSignal('');
  const [dataReady, setDataReady] = createSignal(false);

  // Initialize highlighter on mount
  onMount(async () => {
    await initDiffHighlighter();
    setHighlighterReady(true);
  });

  // Fetch file contents for expansion support
  createEffect(async () => {
    const diffText = props.diff;
    const filePath = props.filePath;
    const workingDir = props.workingDir;

    if (!diffText || diffText.trim().length === 0) {
      setDataReady(false);
      return;
    }

    let oldFileContent = '';
    let newFileContent = '';

    if (workingDir && filePath) {
      // Fetch old content from HEAD (may fail for new files)
      try {
        oldFileContent = await getFileAtRevision(workingDir, filePath, 'HEAD');
      } catch {
        // New file - no old content
      }

      // Fetch current file content from working directory
      try {
        const fullPath = `${workingDir}/${filePath}`.replace(/\/+/g, '/');
        newFileContent = await invoke<string>('read_file', { path: fullPath });
      } catch {
        // Deleted file - no new content
      }
    }

    setOldContent(oldFileContent);
    setNewContent(newFileContent);
    setDataReady(true);
  });

  const getDiffData = () => {
    const diffText = props.diff;
    if (!diffText || diffText.trim().length === 0) return null;

    const language = detectLanguage(props.fileName);

    return {
      oldFile: { fileName: props.fileName, fileLang: language, content: oldContent() },
      newFile: { fileName: props.fileName, fileLang: language, content: newContent() },
      hunks: [diffText],
    };
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
              <Show when={!highlighterReady() || !dataReady()}>
                <span class="ml-2 text-xs text-zed-text-tertiary opacity-70">(loading...)</span>
              </Show>
            </div>
          </div>
        </div>

        {/* Diff Content - render once highlighter and file content are ready */}
        <Show when={dataReady() && highlighterReady() && getDiffData()}>
          {(data) => (
            <DiffView
              data={data()}
              registerHighlighter={getDiffHighlighter()!}
              diffViewMode={viewMode() === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified}
              diffViewWrap={true}
              diffViewHighlight={true}
              diffViewTheme="dark"
              diffViewFontSize={14}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
