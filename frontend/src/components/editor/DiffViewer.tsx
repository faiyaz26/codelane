// DiffViewer using @git-diff-view with Shiki highlighting
import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
import { DiffView, DiffModeEnum } from '@git-diff-view/solid';
import { DiffFile, SplitSide } from '@git-diff-view/core';
import { invoke } from '@tauri-apps/api/core';
import { initDiffHighlighter, getDiffHighlighter } from './diff/shikiHighlighter';
import { getFileAtRevision } from '../../lib/git-api';
import { detectLanguage, getShikiLanguage } from './types';
import { editorSettingsManager } from '../../services/EditorSettingsManager';
import type { DiffViewMode } from './diff/types';
import type { InlineAnnotation } from '../../types/review';

// Import styles
import '@git-diff-view/solid/styles/diff-view.css';

interface DiffViewerProps {
  diff: string;
  fileName: string;
  filePath?: string;
  workingDir?: string;
  embedded?: boolean; // If true, don't add overflow-auto (parent handles scrolling)
  viewMode?: 'unified' | 'split'; // External view mode (overrides internal state)
  annotations?: InlineAnnotation[];
}

export function DiffViewer(props: DiffViewerProps) {
  const [highlighterReady, setHighlighterReady] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<DiffViewMode>(editorSettingsManager.getDiffViewDefaultMode());
  const [oldContent, setOldContent] = createSignal('');
  const [newContent, setNewContent] = createSignal('');
  const [dataReady, setDataReady] = createSignal(false);
  const [diffFileInstance, setDiffFileInstance] = createSignal<DiffFile | null>(null);

  // Reactive effective view mode: use external prop if provided, otherwise internal state
  const effectiveViewMode = createMemo(() => props.viewMode ?? viewMode());

  // Initialize highlighter on mount
  onMount(async () => {
    await initDiffHighlighter();
    setHighlighterReady(true);
  });

  // Fetch file contents for expansion and syntax highlighting
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

  // Create and fully initialize DiffFile when all data is ready.
  // Using diffFile prop (instead of data prop) ensures we control the
  // initialization order, avoiding SolidJS effect ordering issues in the library.
  createEffect(() => {
    const diffText = props.diff;
    const ready = dataReady();
    const hlReady = highlighterReady();
    const old = oldContent();
    const newC = newContent();

    if (!diffText || diffText.trim().length === 0 || !ready || !hlReady) {
      setDiffFileInstance(null);
      return;
    }

    const lang = getShikiLanguage(detectLanguage(props.fileName));

    const file = new DiffFile(
      props.fileName,
      old,
      props.fileName,
      newC,
      [diffText],
      lang,
      lang
    );

    file.initTheme('dark');
    file.initRaw();
    file.initSyntax({ registerHighlighter: getDiffHighlighter()! });
    file.buildSplitDiffLines();
    file.buildUnifiedDiffLines();

    setDiffFileInstance(file);

    onCleanup(() => file.clear());
  });

  // Build extendData for inline annotations
  const extendData = createMemo(() => {
    const annotations = props.annotations;
    if (!annotations || annotations.length === 0) return undefined;

    const newFile: Record<string, { data: InlineAnnotation[] } | undefined> = {};
    for (const annotation of annotations) {
      const key = String(annotation.line);
      if (newFile[key]) {
        newFile[key]!.data.push(annotation);
      } else {
        newFile[key] = { data: [annotation] };
      }
    }

    return { newFile };
  });

  // Inline styles needed because @git-diff-view resets `color: initial` on
  // .diff-line-extend-wrapper * and .diff-line-widget-wrapper *, overriding Tailwind classes.
  const severityInlineStyles: Record<string, { border: string; background: string; color: string }> = {
    info: { border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
    warning: { border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    error: { border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' },
  };

  const severityIcons: Record<string, string> = {
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  };

  const renderExtendLine = (renderProps: {
    lineNumber: number;
    side: SplitSide;
    data: InlineAnnotation[];
    diffFile: DiffFile;
    onUpdate: () => void;
  }) => {
    return (
      <div class="py-1 px-2">
        <For each={renderProps.data}>
          {(annotation) => {
            const severity = annotation.severity || 'info';
            const styles = severityInlineStyles[severity];
            return (
              <div
                class="px-3 py-1.5 my-0.5 rounded text-xs"
                style={{ border: styles.border, background: styles.background, color: styles.color }}
              >
                <div class="flex items-start gap-2">
                  <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke={styles.color} viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={severityIcons[severity]} />
                  </svg>
                  <span class="leading-relaxed" style={{ color: 'rgb(230,230,230)' }}>{annotation.comment}</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    );
  };

  return (
    <div class={`w-full bg-zed-bg-app ${props.embedded ? '' : 'h-full overflow-auto'}`}>
      <Show
        when={props.diff && props.diff.trim().length > 0}
        fallback={
          <div class={`flex items-center justify-center text-zed-text-tertiary ${props.embedded ? 'py-8' : 'h-full'}`}>
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
        {/* Diff Header - hide in embedded mode (ReviewFileScrollView has its own headers) */}
        <Show when={!props.embedded}>
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
        </Show>

        {/* Diff Content - render once DiffFile is fully initialized */}
        <Show when={diffFileInstance()}>
          {(file) => (
            <DiffView
              diffFile={file()}
              diffViewMode={effectiveViewMode() === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified}
              diffViewWrap={true}
              diffViewHighlight={true}
              diffViewTheme="dark"
              diffViewFontSize={14}
              extendData={extendData()}
              renderExtendLine={extendData() ? renderExtendLine : undefined}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
