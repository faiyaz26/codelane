// TipTap editor factory function
// Creates and manages TipTap editor instance with proper cleanup
// Note: This is NOT a hook - it's a factory function called in onMount

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import CodeBlockShiki from 'tiptap-extension-code-block-shiki';

export interface TipTapEditorOptions {
  element: HTMLElement;
  content: string;
  onReady?: (editor: Editor, normalizedContent: string) => void;
  onContentChange?: (markdown: string) => void;
  onSelectionChange?: (editor: Editor, hasSelection: boolean, coords?: { x: number; y: number }) => void;
}

export interface TipTapEditorInstance {
  editor: () => Editor | null;
  isReady: () => boolean;
  getMarkdown: () => string;
  setContent: (content: string) => void;
  destroy: () => void;
}

// Normalize content for comparison (trim whitespace, normalize line endings)
export function normalizeForComparison(content: string): string {
  return content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n+$/, '') // Remove trailing newlines
    .trim();
}

/**
 * Creates a TipTap editor instance.
 * IMPORTANT: This is a factory function, NOT a SolidJS hook.
 * Call it inside onMount and call destroy() in onCleanup.
 */
export function createTipTapEditor(options: TipTapEditorOptions): TipTapEditorInstance {
  // Track state without signals - we don't need reactivity here
  let editorInstance: Editor | null = null;
  let ready = false;
  let destroyed = false;

  // Create editor synchronously
  const ed = new Editor({
    element: options.element,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Disable default codeBlock, use CodeBlockShiki instead
        codeBlock: false,
      }),
      // Shiki-powered syntax highlighting for code blocks
      CodeBlockShiki.configure({
        defaultLanguage: 'text',
        defaultTheme: 'github-dark-default',
        // Dual themes for light/dark mode support
        themes: {
          light: 'github-light-default',
          dark: 'github-dark-default',
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
    content: options.content,
    editorProps: {
      attributes: {
        class: 'markdown-editor',
      },
    },
    onCreate: ({ editor }) => {
      if (destroyed) return;

      // Capture normalized content AFTER TipTap has processed it
      const processedContent = editor.storage.markdown.getMarkdown();
      const normalized = normalizeForComparison(processedContent);

      ready = true;
      options.onReady?.(editor, normalized);
    },
    onUpdate: ({ editor }) => {
      if (destroyed || !ready) return;

      const md = editor.storage.markdown.getMarkdown();
      options.onContentChange?.(md);
    },
    onSelectionUpdate: ({ editor }) => {
      if (destroyed) return;

      const { from, to } = editor.state.selection;
      const hasSelection = from !== to && !editor.state.selection.empty;

      if (hasSelection) {
        const coords = editor.view.coordsAtPos(from);
        options.onSelectionChange?.(editor, true, {
          x: coords.left,
          y: coords.top - 50,
        });
      } else {
        options.onSelectionChange?.(editor, false);
      }
    },
  });

  editorInstance = ed;

  return {
    editor: () => destroyed ? null : editorInstance,
    isReady: () => ready && !destroyed,
    getMarkdown: () => {
      if (!editorInstance || destroyed) return '';
      return editorInstance.storage.markdown.getMarkdown();
    },
    setContent: (content: string) => {
      if (!editorInstance || destroyed) return;
      editorInstance.commands.setContent(content);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      ready = false;

      // Destroy TipTap to prevent any more callbacks
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
    },
  };
}
