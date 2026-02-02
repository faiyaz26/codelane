// Floating Toolbar - formatting toolbar that appears on text selection

import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import type { Editor } from '@tiptap/core';

interface FloatingToolbarProps {
  editor: Editor;
  position: { x: number; y: number };
  onClose: () => void;
}

export function FloatingToolbar(props: FloatingToolbarProps) {
  const [showLinkInput, setShowLinkInput] = createSignal(false);
  const [linkUrl, setLinkUrl] = createSignal('');
  let toolbarRef: HTMLDivElement | undefined;
  let linkInputRef: HTMLInputElement | undefined;

  // Position adjustment to keep toolbar in viewport
  const getAdjustedPosition = () => {
    const x = Math.max(10, Math.min(props.position.x, window.innerWidth - 280));
    const y = Math.max(10, props.position.y);
    return { x, y };
  };

  const pos = getAdjustedPosition();

  // Toggle bold
  const toggleBold = () => {
    props.editor.chain().focus().toggleBold().run();
  };

  // Toggle italic
  const toggleItalic = () => {
    props.editor.chain().focus().toggleItalic().run();
  };

  // Toggle strikethrough
  const toggleStrike = () => {
    props.editor.chain().focus().toggleStrike().run();
  };

  // Toggle inline code
  const toggleCode = () => {
    props.editor.chain().focus().toggleCode().run();
  };

  // Show link input
  const showLink = () => {
    const previousUrl = props.editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
    setTimeout(() => linkInputRef?.focus(), 0);
  };

  // Set link
  const setLink = () => {
    const url = linkUrl().trim();
    if (url) {
      props.editor.chain().focus().setLink({ href: url }).run();
    } else {
      props.editor.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Remove link
  const removeLink = () => {
    props.editor.chain().focus().unsetLink().run();
    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Cancel link input
  const cancelLink = () => {
    setShowLinkInput(false);
    setLinkUrl('');
  };

  // Set heading level
  const setHeading = (level: 1 | 2 | 3) => {
    props.editor.chain().focus().toggleHeading({ level }).run();
  };

  // Toggle blockquote
  const toggleBlockquote = () => {
    props.editor.chain().focus().toggleBlockquote().run();
  };

  // Handle link input keydown
  const handleLinkKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelLink();
    }
  };

  // Click outside handler
  const handleClickOutside = (e: MouseEvent) => {
    if (toolbarRef && !toolbarRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <div
      ref={toolbarRef}
      class="fixed z-50"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
    >
      <Show
        when={!showLinkInput()}
        fallback={
          <div class="link-input-popup">
            <input
              ref={linkInputRef}
              type="text"
              placeholder="Enter URL..."
              value={linkUrl()}
              onInput={(e) => setLinkUrl(e.currentTarget.value)}
              onKeyDown={handleLinkKeyDown}
            />
            <button class="btn-confirm" onClick={setLink}>
              Apply
            </button>
            <Show when={props.editor.isActive('link')}>
              <button class="btn-cancel" onClick={removeLink}>
                Remove
              </button>
            </Show>
            <button class="btn-cancel" onClick={cancelLink}>
              Cancel
            </button>
          </div>
        }
      >
        {/* Prevent mousedown from stealing focus/selection from editor */}
        <div class="floating-toolbar" onMouseDown={(e) => e.preventDefault()}>
          {/* Bold */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('bold') }}
            onClick={toggleBold}
            title="Bold (Cmd+B)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </button>

          {/* Italic */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('italic') }}
            onClick={toggleItalic}
            title="Italic (Cmd+I)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4h4M14 4l-4 16M6 20h4" />
            </svg>
          </button>

          {/* Strikethrough */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('strike') }}
            onClick={toggleStrike}
            title="Strikethrough"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5c-2.5 0-4 1.5-4 3.5S10 12 12 12s4-1 4 3.5-1.5 3.5-4 3.5" />
            </svg>
          </button>

          {/* Inline code */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('code') }}
            onClick={toggleCode}
            title="Inline code"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </button>

          <div class="floating-toolbar-separator" />

          {/* Link */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('link') }}
            onClick={showLink}
            title="Link (Cmd+K)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>

          <div class="floating-toolbar-separator" />

          {/* Heading 1 */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('heading', { level: 1 }) }}
            onClick={() => setHeading(1)}
            title="Heading 1"
          >
            <span class="text-xs font-bold">H1</span>
          </button>

          {/* Heading 2 */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('heading', { level: 2 }) }}
            onClick={() => setHeading(2)}
            title="Heading 2"
          >
            <span class="text-xs font-bold">H2</span>
          </button>

          {/* Heading 3 */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('heading', { level: 3 }) }}
            onClick={() => setHeading(3)}
            title="Heading 3"
          >
            <span class="text-xs font-bold">H3</span>
          </button>

          <div class="floating-toolbar-separator" />

          {/* Blockquote */}
          <button
            class="floating-toolbar-btn"
            classList={{ 'is-active': props.editor.isActive('blockquote') }}
            onClick={toggleBlockquote}
            title="Blockquote"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      </Show>
    </div>
  );
}
