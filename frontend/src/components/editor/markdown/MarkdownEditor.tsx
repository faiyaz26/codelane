// Markdown Editor - TipTap-based WYSIWYG editor with live preview
// Refactored for clean architecture with modular hooks

import { createSignal, onMount, onCleanup, Show, createEffect, createMemo } from 'solid-js';
import type { Editor } from '@tiptap/core';
import type { OpenFile } from '../types';
import { FloatingToolbar } from './FloatingToolbar';
import { editorStateManager } from '../../../services/EditorStateManager';
import { editorSettingsManager } from '../../../services/EditorSettingsManager';
import { useShikiHighlighter, createTipTapEditor, useMarkdownSave, type TipTapEditorInstance } from './hooks';
import { useExternalContentSync } from '../hooks';
import './markdown-editor.css';

interface MarkdownEditorProps {
  file: OpenFile;
  laneId?: string;
  onModifiedChange?: (isModified: boolean) => void;
  onSave?: (content: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  // Mode toggle: preview (WYSIWYG) or source (raw markdown)
  // If forceSourceMode is set (e.g., opened from search), start in source mode
  const [mode, setMode] = createSignal<'preview' | 'source'>(
    props.file.forceSourceMode ? 'source' : editorSettingsManager.getMarkdownDefaultMode()
  );

  // Track the last forced timestamp to avoid re-applying the same force
  const [lastForcedTimestamp, setLastForcedTimestamp] = createSignal<number | undefined>(
    props.file.forceSourceMode
  );

  // React to forceSourceMode changes (e.g., clicking search result when file already open)
  // forceSourceMode is a timestamp that changes each time we want to force source mode
  createEffect(() => {
    const forceTimestamp = props.file.forceSourceMode;
    // Only switch to source mode if this is a NEW timestamp we haven't acted on yet
    if (forceTimestamp && forceTimestamp !== lastForcedTimestamp()) {
      // Get current content from TipTap if in preview mode
      const currentContent = tipTapEditor?.getMarkdown() || props.file.content || '';
      setSourceContent(currentContent);
      setMode('source');
      setLastForcedTimestamp(forceTimestamp);
    }
  });

  // TipTap editor instance (created after mount when ref is available)
  // Declared early so it can be used in useExternalContentSync callback
  let tipTapEditor: TipTapEditorInstance | null = null;

  // Flag to skip modified state update during external reload
  let isExternalReload = false;

  // External content sync - handles file reloads from external changes
  const contentSync = useExternalContentSync({
    file: props.file,
    onExternalChange: (newContent) => {
      // Set flag to prevent marking as modified
      isExternalReload = true;

      // Update TipTap editor if it exists
      if (tipTapEditor) {
        tipTapEditor.setContent(newContent);
      }

      // Reset flag after a tick (after TipTap's change event fires)
      setTimeout(() => {
        isExternalReload = false;
        // Also update the save manager's original content so it doesn't think we have changes
        saveManager?.setOriginalContent(newContent);
      }, 0);
    },
  });

  // Use synced content for source mode
  const sourceContent = contentSync.content;
  const setSourceContent = contentSync.setContent;

  // Floating toolbar state
  const [showToolbar, setShowToolbar] = createSignal(false);
  const [toolbarPosition, setToolbarPosition] = createSignal({ x: 0, y: 0 });

  // DOM refs
  let editorRef: HTMLDivElement | undefined;
  let sourceTextareaRef: HTMLTextAreaElement | undefined;
  let highlightContainerRef: HTMLPreElement | undefined;

  // Shiki syntax highlighting for source mode
  const highlightedSource = useShikiHighlighter({
    content: sourceContent,
  });

  // Add search match highlighting to source view
  const highlightedSourceWithMatches = createMemo(() => {
    let html = highlightedSource();
    const highlight = props.file.highlightMatch;

    if (!highlight || mode() !== 'source') return html;

    // Wait for content to be highlighted before attempting to add search highlights
    if (!html || html.trim().length === 0) {
      return html;
    }

    // Validate match data
    if (highlight.line < 1 || highlight.column < 0 || !highlight.text) {
      return html;
    }

    // Split HTML into lines
    const lines = html.split('\n');
    const lineIdx = highlight.line - 1; // Convert to 0-indexed

    if (lineIdx < 0 || lineIdx >= lines.length) {
      return html;
    }

    // Get the line to highlight
    let lineHtml = lines[lineIdx];

    // Extract text content to find match position
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = lineHtml;
    const textContent = tempDiv.textContent || '';

    // Validate column is within bounds
    if (highlight.column < 0 || highlight.column >= textContent.length) {
      return html;
    }

    // Find and wrap the match in the HTML
    const startCol = highlight.column;
    const endCol = Math.min(startCol + highlight.text.length, textContent.length);

    // Simple approach: inject highlight span at the right position in the HTML
    let result = '';
    let htmlIdx = 0;
    let textIdx = 0;
    let highlightAdded = false;

    while (htmlIdx < lineHtml.length) {
      // Add highlight span when we reach the start position
      if (!highlightAdded && textIdx === startCol) {
        result += '<span class="search-match search-match-current">';
        highlightAdded = true;
      }

      // Close highlight span when we reach the end position
      if (highlightAdded && textIdx === endCol) {
        result += '</span>';
        highlightAdded = false;
      }

      // Process HTML character by character
      if (lineHtml[htmlIdx] === '<') {
        // Skip HTML tag
        const tagEnd = lineHtml.indexOf('>', htmlIdx);
        if (tagEnd !== -1) {
          result += lineHtml.substring(htmlIdx, tagEnd + 1);
          htmlIdx = tagEnd + 1;
        } else {
          result += lineHtml[htmlIdx++];
        }
      } else if (lineHtml[htmlIdx] === '&') {
        // Handle HTML entities
        const entityEnd = lineHtml.indexOf(';', htmlIdx);
        if (entityEnd !== -1 && entityEnd - htmlIdx < 10) {
          result += lineHtml.substring(htmlIdx, entityEnd + 1);
          htmlIdx = entityEnd + 1;
          textIdx++;
        } else {
          result += lineHtml[htmlIdx++];
          textIdx++;
        }
      } else {
        result += lineHtml[htmlIdx++];
        textIdx++;
      }
    }

    // Close highlight span if still open
    if (highlightAdded) {
      result += '</span>';
    }

    // Replace the line in the HTML
    lines[lineIdx] = result;
    return lines.join('\n');
  });

  // Save functionality hook
  const saveManager = useMarkdownSave({
    laneId: props.laneId,
    fileId: props.file.id,
    filePath: props.file.path,
    getContent: () => {
      if (mode() === 'source') {
        return sourceContent();
      }
      return tipTapEditor?.getMarkdown() || sourceContent();
    },
    onSaveComplete: (content) => {
      props.onSave?.(content);
    },
    onModifiedChange: (modified) => {
      props.onModifiedChange?.(modified);
    },
  });

  // Handle content changes from TipTap
  const handleTipTapContentChange = (markdown: string) => {
    if (mode() !== 'preview') return;
    // Skip modified state update during external reload to prevent false positives
    if (isExternalReload) return;
    saveManager.updateModifiedState(markdown);
  };

  // Handle selection changes for floating toolbar
  const handleSelectionChange = (editor: Editor, hasSelection: boolean, coords?: { x: number; y: number }) => {
    if (mode() !== 'preview') {
      setShowToolbar(false);
      return;
    }

    // Don't show toolbar for readonly files
    if (props.file.isReadonly) {
      setShowToolbar(false);
      return;
    }

    if (hasSelection && coords) {
      setToolbarPosition(coords);
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  // Sync scroll between textarea and highlight container in source mode
  const handleSourceScroll = () => {
    if (sourceTextareaRef && highlightContainerRef) {
      highlightContainerRef.scrollTop = sourceTextareaRef.scrollTop;
      highlightContainerRef.scrollLeft = sourceTextareaRef.scrollLeft;
    }
  };

  // Handle source content changes
  const handleSourceChange = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value;
    setSourceContent(value);
    saveManager.updateModifiedState(value);
  };

  // Toggle between preview and source mode
  const toggleMode = () => {
    if (mode() === 'preview') {
      // Switching to source: get markdown from TipTap
      const md = tipTapEditor?.getMarkdown() || '';
      setSourceContent(md);
      setMode('source');
    } else {
      // Switching to preview: set markdown content in TipTap
      tipTapEditor?.setContent(sourceContent());
      setMode('preview');
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent backspace from triggering browser back navigation
    if (e.key === 'Backspace') {
      const target = e.target as HTMLElement;
      const isEditable = target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.isContentEditable ||
                        target.closest('.ProseMirror');
      if (!isEditable) {
        e.preventDefault();
        return;
      }
    }

    // Cmd/Ctrl + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveManager.save();
      return;
    }

    // Cmd/Ctrl + Shift + V to toggle mode
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      toggleMode();
      return;
    }
  };

  // Initialize TipTap editor after mount
  onMount(() => {
    if (!editorRef) return;

    tipTapEditor = createTipTapEditor({
      element: editorRef,
      content: props.file.content || '',
      editable: !props.file.isReadonly,
      onReady: (_editor, normalizedContent) => {
        // Set the original content for modification tracking
        saveManager.setOriginalContent(normalizedContent);
      },
      onContentChange: handleTipTapContentChange,
      onSelectionChange: handleSelectionChange,
    });

    // Register keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    // Register save callback so EditorPanel can trigger save
    if (props.laneId && props.file.id) {
      editorStateManager.registerSaveCallback(props.laneId, props.file.id, saveManager.save);
    }
  });

  // Cleanup
  onCleanup(() => {
    // Destroy TipTap FIRST to prevent any callbacks firing during disposal
    if (tipTapEditor) {
      tipTapEditor.destroy();
      tipTapEditor = null;
    }

    // Remove keyboard listener
    window.removeEventListener('keydown', handleKeyDown);

    // Unregister save callback
    if (props.laneId && props.file.id) {
      editorStateManager.unregisterSaveCallback(props.laneId, props.file.id);
    }
  });

  // Get editor for toolbar (safe accessor)
  const getEditor = () => tipTapEditor?.editor() || null;

  return (
    <div class="h-full flex flex-col bg-zed-bg-surface relative">
      {/* Header bar */}
      <div class="h-7 px-4 border-b border-zed-border-subtle flex items-center justify-end text-xs bg-zed-bg-panel">
        <div class="flex items-center gap-4 text-zed-text-disabled flex-shrink-0">
          {/* Mode toggle */}
          <div class="markdown-mode-toggle">
            <button
              classList={{ active: mode() === 'preview' }}
              onClick={() => mode() !== 'preview' && toggleMode()}
              title="Live preview with inline editing"
            >
              Live Preview
            </button>
            <button
              classList={{ active: mode() === 'source' }}
              onClick={() => mode() !== 'source' && toggleMode()}
              title="Source mode"
            >
              Source
            </button>
          </div>

          {/* Save status */}
          <Show when={saveManager.isSaving()}>
            <span class="text-zed-text-tertiary">Saving...</span>
          </Show>
          <Show when={saveManager.saveError()}>
            <span class="text-zed-accent-red" title={saveManager.saveError()!}>Save failed</span>
          </Show>
        </div>
      </div>

      {/* Editor area */}
      <div class="flex-1 overflow-auto relative">
        {/* Preview mode - TipTap editor */}
        <div
          ref={editorRef}
          class="h-full"
          style={{ display: mode() === 'preview' ? 'block' : 'none' }}
        />

        {/* Floating toolbar */}
        <Show when={showToolbar() && mode() === 'preview' && getEditor()}>
          <FloatingToolbar
            editor={getEditor()!}
            position={toolbarPosition()}
            onClose={() => setShowToolbar(false)}
          />
        </Show>

        {/* Source mode - syntax highlighted editor */}
        <Show when={mode() === 'source'}>
          <div class="source-editor-container">
            {/* Highlighted code display (background layer) */}
            <pre
              ref={highlightContainerRef}
              class="source-highlight-layer"
              innerHTML={highlightedSourceWithMatches()}
            />
            {/* Textarea for input (foreground layer - transparent text) */}
            <textarea
              ref={sourceTextareaRef}
              class="source-input-layer"
              value={sourceContent()}
              onInput={handleSourceChange}
              onScroll={handleSourceScroll}
              spellcheck={false}
              readOnly={props.file.isReadonly}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
