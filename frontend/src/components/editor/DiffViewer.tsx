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
import type { InlineAnnotation, PendingReviewComment, PrReviewComment } from '../../types/review';

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
  // PR review comment props
  enableAddComment?: boolean;
  pendingComments?: PendingReviewComment[];
  githubComments?: PrReviewComment[];
  onAddComment?: (line: number, body: string) => void;
  onUpdateComment?: (commentId: string, body: string) => void;
  onRemoveComment?: (commentId: string) => void;
}

export function DiffViewer(props: DiffViewerProps) {
  const [highlighterReady, setHighlighterReady] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<DiffViewMode>(editorSettingsManager.getDiffViewDefaultMode());
  const [oldContent, setOldContent] = createSignal('');
  const [newContent, setNewContent] = createSignal('');
  const [dataReady, setDataReady] = createSignal(false);
  const [diffFileInstance, setDiffFileInstance] = createSignal<DiffFile | null>(null);

  // Widget state for comment boxes
  const [editingCommentId, setEditingCommentId] = createSignal<string | null>(null);

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

  // Build extendData for inline annotations + GitHub comments + pending comments
  const extendData = createMemo(() => {
    const annotations = props.annotations;
    const githubComments = props.githubComments;
    const pendingComments = props.pendingComments;

    const hasAnnotations = annotations && annotations.length > 0;
    const hasGhComments = githubComments && githubComments.length > 0;
    const hasPending = pendingComments && pendingComments.length > 0;

    if (!hasAnnotations && !hasGhComments && !hasPending) return undefined;

    const newFile: Record<string, { data: InlineAnnotation[] } | undefined> = {};

    const addToLine = (line: number, annotation: InlineAnnotation) => {
      const key = String(line);
      if (newFile[key]) {
        newFile[key]!.data.push(annotation);
      } else {
        newFile[key] = { data: [annotation] };
      }
    };

    // Add GitHub review comments (shown as published)
    if (hasGhComments) {
      for (const c of githubComments!) {
        if (c.line !== null) {
          addToLine(c.line, {
            line: c.line,
            comment: c.body,
            source: 'github',
            user: c.user,
            id: c.id,
          });
        }
      }
    }

    // Add pending comments
    if (hasPending) {
      for (const c of pendingComments!) {
        addToLine(c.line, {
          line: c.line,
          comment: c.body,
          source: 'github', // Render similarly but with pending badge
          user: 'You (pending)',
          id: undefined,
        });
      }
    }

    // Add AI annotations
    if (hasAnnotations) {
      for (const annotation of annotations!) {
        addToLine(annotation.line, annotation);
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

  // GitHub comment styling
  const githubCommentStyle = {
    published: { border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.1)', color: '#c4b5fd' },
    pending: { border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
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
            // GitHub-sourced comment (published or pending)
            if (annotation.source === 'github') {
              const isPending = annotation.user === 'You (pending)';
              const styles = isPending ? githubCommentStyle.pending : githubCommentStyle.published;
              return (
                <div
                  class="px-3 py-1.5 my-0.5 rounded text-xs"
                  style={{ border: styles.border, background: styles.background, color: styles.color }}
                >
                  <div class="flex items-start gap-2">
                    {/* Chat bubble icon */}
                    <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke={styles.color} viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <span style={{ color: 'rgb(200,200,200)', 'font-weight': '500' }}>@{annotation.user}</span>
                        <span
                          class="text-[10px] px-1.5 py-0 rounded-full"
                          style={{
                            background: isPending ? 'rgba(245,158,11,0.2)' : 'rgba(139,92,246,0.2)',
                            color: isPending ? '#fbbf24' : '#c4b5fd',
                          }}
                        >
                          {isPending ? 'Pending' : 'Published'}
                        </span>
                      </div>
                      <span class="leading-relaxed" style={{ color: 'rgb(230,230,230)' }}>{annotation.comment}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // AI annotation (existing behavior)
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

  // Widget line renderer for inline comment box (when user clicks "+" on a line)
  const renderWidgetLine = (widgetProps: {
    lineNumber: number;
    side: SplitSide;
    diffFile: DiffFile;
    onClose: () => void;
  }) => {
    // Pre-populate if editing an existing pending comment
    const pendingOnLine = props.pendingComments?.filter(c => c.line === widgetProps.lineNumber) || [];
    const existingComment = pendingOnLine.length > 0 ? pendingOnLine[0] : null;

    // Track local text state for this widget
    const [widgetText, setWidgetText] = createSignal(existingComment?.body || '');

    const handleSave = () => {
      const text = widgetText().trim();
      if (!text) return;

      if (existingComment && editingCommentId() === existingComment.id) {
        props.onUpdateComment?.(existingComment.id, text);
        setEditingCommentId(null);
      } else {
        props.onAddComment?.(widgetProps.lineNumber, text);
      }
      setWidgetText('');
      widgetProps.onClose();
    };

    const handleDelete = () => {
      if (existingComment) {
        props.onRemoveComment?.(existingComment.id);
      }
      widgetProps.onClose();
    };

    return (
      <div class="px-2 py-2" style={{ background: 'rgba(30,30,40,0.95)' }}>
        <div
          class="rounded-md overflow-hidden"
          style={{ border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(20,20,30,0.95)' }}
        >
          <div class="flex items-center justify-between px-3 py-1.5" style={{ 'border-bottom': '1px solid rgba(139,92,246,0.2)' }}>
            <span class="text-xs" style={{ color: '#c4b5fd', 'font-weight': '500' }}>
              {existingComment ? 'Edit Comment' : 'Add Comment'} — Line {widgetProps.lineNumber}
            </span>
            <span class="text-[10px] px-1.5 py-0 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>
              Pending
            </span>
          </div>
          <textarea
            class="w-full px-3 py-2 text-xs resize-none focus:outline-none"
            style={{
              background: 'transparent',
              color: 'rgb(230,230,230)',
              'min-height': '60px',
              'font-family': 'inherit',
            }}
            placeholder="Write a review comment... (Markdown supported)"
            value={widgetText()}
            onInput={(e) => setWidgetText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                widgetProps.onClose();
              }
            }}
            ref={(el) => setTimeout(() => el.focus(), 0)}
          />
          <div class="flex items-center justify-between px-3 py-1.5" style={{ 'border-top': '1px solid rgba(139,92,246,0.2)' }}>
            <span class="text-[10px]" style={{ color: 'rgba(200,200,200,0.5)' }}>
              {'\u2318'}+Enter to save · Esc to cancel
            </span>
            <div class="flex items-center gap-2">
              <Show when={existingComment}>
                <button
                  onClick={handleDelete}
                  class="px-2 py-0.5 text-xs rounded transition-colors"
                  style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)' }}
                >
                  Delete
                </button>
              </Show>
              <button
                onClick={() => widgetProps.onClose()}
                class="px-2 py-0.5 text-xs rounded transition-colors"
                style={{ color: 'rgba(200,200,200,0.7)', background: 'rgba(200,200,200,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!widgetText().trim()}
                class="px-2 py-0.5 text-xs rounded transition-colors"
                style={{
                  color: widgetText().trim() ? '#c4b5fd' : 'rgba(200,200,200,0.3)',
                  background: widgetText().trim() ? 'rgba(139,92,246,0.2)' : 'rgba(200,200,200,0.05)',
                  cursor: widgetText().trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
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
              diffViewAddWidget={props.enableAddComment}
              extendData={extendData()}
              renderExtendLine={extendData() ? renderExtendLine : undefined}
              renderWidgetLine={props.enableAddComment ? renderWidgetLine : undefined}
            />
          )}
        </Show>
      </Show>
    </div>
  );
}
