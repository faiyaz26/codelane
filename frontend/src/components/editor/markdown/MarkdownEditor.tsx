// Markdown Editor - TipTap-based WYSIWYG editor with live preview

import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { createHighlighter, type Highlighter } from 'shiki';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import type { OpenFile } from '../types';
import { FloatingToolbar } from './FloatingToolbar';
import { editorStateManager } from '../../../services/EditorStateManager';
import { editorSettingsManager } from '../../../services/EditorSettingsManager';
import { themeManager, type ThemeId } from '../../../services/ThemeManager';
import './markdown-editor.css';

// Shiki highlighter singleton
let highlighterPromise: Promise<Highlighter> | null = null;

function getShikiTheme(themeId: ThemeId): string {
  switch (themeId) {
    case 'light':
      return 'github-light-default';
    case 'zed-dark':
      return 'one-dark-pro';
    case 'dark':
    default:
      return 'github-dark-default';
  }
}

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark-default', 'github-light-default', 'one-dark-pro'],
      langs: ['markdown'],
    });
  }
  return highlighterPromise;
}

interface MarkdownEditorProps {
  file: OpenFile;
  laneId?: string;
  onModifiedChange?: (isModified: boolean) => void;
  onSave?: (content: string) => void;
}

// Normalize content for comparison (trim whitespace, normalize line endings)
function normalizeForComparison(content: string): string {
  return content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n+$/, '') // Remove trailing newlines
    .trim();
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  // Use default mode from settings
  const [mode, setMode] = createSignal<'preview' | 'source'>(
    editorSettingsManager.getMarkdownDefaultMode()
  );
  const [sourceContent, setSourceContent] = createSignal(props.file.content || '');
  const [isModified, setIsModified] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [showToolbar, setShowToolbar] = createSignal(false);
  const [toolbarPosition, setToolbarPosition] = createSignal({ x: 0, y: 0 });
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);
  const [highlightedSource, setHighlightedSource] = createSignal('');
  const [isEditorReady, setIsEditorReady] = createSignal(false);

  let editorRef: HTMLDivElement | undefined;
  let sourceTextareaRef: HTMLTextAreaElement | undefined;
  let highlightContainerRef: HTMLPreElement | undefined;

  // Highlight source content with Shiki
  createEffect(() => {
    const content = sourceContent();
    const currentTheme = themeManager.getTheme()();

    if (!content) {
      setHighlightedSource('');
      return;
    }

    (async () => {
      try {
        const highlighter = await getHighlighter();
        const html = highlighter.codeToHtml(content, {
          lang: 'markdown',
          theme: getShikiTheme(currentTheme),
        });
        setHighlightedSource(html);
      } catch (err) {
        console.error('Failed to highlight markdown:', err);
        // Fallback to escaped HTML
        const escaped = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setHighlightedSource(`<pre><code>${escaped}</code></pre>`);
      }
    })();
  });

  // Sync scroll between textarea and highlight container
  const handleSourceScroll = () => {
    if (sourceTextareaRef && highlightContainerRef) {
      highlightContainerRef.scrollTop = sourceTextareaRef.scrollTop;
      highlightContainerRef.scrollLeft = sourceTextareaRef.scrollLeft;
    }
  };

  // Original content for comparison (normalized after TipTap processes it)
  let originalNormalizedContent = '';

  // Check if content has changed from original
  const checkIfModified = (currentContent: string): boolean => {
    if (!isEditorReady()) return false;
    return normalizeForComparison(currentContent) !== originalNormalizedContent;
  };

  // Update modified state
  const updateModifiedState = (currentContent: string) => {
    const modified = checkIfModified(currentContent);
    if (isModified() !== modified) {
      setIsModified(modified);
      props.onModifiedChange?.(modified);
      if (props.laneId) {
        editorStateManager.setFileModified(props.laneId, props.file.id, modified);
      }
    }
  };

  // Initialize TipTap editor after mount
  onMount(() => {
    if (!editorRef) return;

    const ed = new Editor({
      element: editorRef,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
          codeBlock: {
            HTMLAttributes: {
              class: 'code-block',
            },
          },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'markdown-link',
          },
        }),
        Markdown.configure({
          html: true,
          tightLists: true,
          bulletListMarker: '-',
          linkify: false,
          breaks: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
      ],
      content: props.file.content || '',
      editorProps: {
        attributes: {
          class: 'markdown-editor',
        },
      },
      onCreate: ({ editor }) => {
        // Capture the normalized content AFTER TipTap has processed it
        // This ensures we're comparing apples to apples
        const processedContent = editor.storage.markdown.getMarkdown();
        originalNormalizedContent = normalizeForComparison(processedContent);
        setIsEditorReady(true);
      },
      onUpdate: ({ editor }) => {
        // Only track changes in preview mode and after editor is ready
        if (mode() !== 'preview' || !isEditorReady()) return;

        const md = editor.storage.markdown.getMarkdown();
        updateModifiedState(md);
      },
      onSelectionUpdate: ({ editor }) => {
        // Only show toolbar in preview mode
        if (mode() !== 'preview') {
          setShowToolbar(false);
          return;
        }

        const { from, to } = editor.state.selection;
        const hasSelection = from !== to;

        if (hasSelection && !editor.state.selection.empty) {
          // Get selection coordinates for toolbar positioning
          const coords = editor.view.coordsAtPos(from);
          setToolbarPosition({
            x: coords.left,
            y: coords.top - 50,
          });
          setShowToolbar(true);
        } else {
          setShowToolbar(false);
        }
      },
    });

    setEditorInstance(ed);
  });

  // Save file
  const saveFile = async () => {
    if (!isModified() || isSaving()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      let contentToSave: string;
      const ed = editorInstance();

      if (mode() === 'source') {
        contentToSave = sourceContent();
      } else if (ed) {
        // Use TipTap markdown extension to get markdown
        contentToSave = ed.storage.markdown.getMarkdown();
      } else {
        contentToSave = sourceContent();
      }

      await invoke('write_file', {
        path: props.file.path,
        contents: contentToSave,
      });

      // Update the original content to the saved content
      originalNormalizedContent = normalizeForComparison(contentToSave);
      setIsModified(false);
      props.onModifiedChange?.(false);
      props.onSave?.(contentToSave);
      // Update state manager
      if (props.laneId) {
        editorStateManager.updateFileContent(props.laneId, props.file.id, contentToSave);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent backspace from triggering browser back navigation
    // when not in an editable element
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
      saveFile();
      return;
    }

    // Cmd/Ctrl + Shift + V to toggle mode
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'v') {
      e.preventDefault();
      toggleMode();
      return;
    }
  };

  // Toggle between preview and source mode
  const toggleMode = () => {
    const ed = editorInstance();

    if (mode() === 'preview' && ed) {
      // Switching to source: get markdown from TipTap
      const md = ed.storage.markdown.getMarkdown();
      setSourceContent(md);
      setMode('source');
    } else {
      // Switching to preview: set markdown content in TipTap
      if (ed) {
        // The Markdown extension handles parsing markdown content
        ed.commands.setContent(sourceContent());
      }
      setMode('preview');
    }
  };

  // Handle source content change
  const handleSourceChange = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value;
    setSourceContent(value);
    updateModifiedState(value);
  };

  // Register keyboard listener and save callback
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    // Register save callback so EditorPanel can trigger save
    if (props.laneId) {
      editorStateManager.registerSaveCallback(props.laneId, props.file.id, saveFile);
    }
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    // Unregister save callback
    if (props.laneId) {
      editorStateManager.unregisterSaveCallback(props.laneId, props.file.id);
    }
    const ed = editorInstance();
    if (ed) {
      ed.destroy();
    }
  });

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
          <Show when={isSaving()}>
            <span class="text-zed-text-tertiary">Saving...</span>
          </Show>
          <Show when={saveError()}>
            <span class="text-zed-accent-red" title={saveError()!}>Save failed</span>
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
        <Show when={showToolbar() && mode() === 'preview' && editorInstance()}>
          <FloatingToolbar
            editor={editorInstance()!}
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
              innerHTML={highlightedSource()}
            />
            {/* Textarea for input (foreground layer - transparent text) */}
            <textarea
              ref={sourceTextareaRef}
              class="source-input-layer"
              value={sourceContent()}
              onInput={handleSourceChange}
              onScroll={handleSourceScroll}
              spellcheck={false}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
