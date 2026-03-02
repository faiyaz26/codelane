import { onMount, onCleanup } from 'solid-js';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Global clipboard handler (copy/paste/cut) using Tauri clipboard API.
 * Tauri webviews don't support native clipboard shortcuts natively well in all contexts,
 * so we handle them globally here. Terminal has its own clipboard handling via xterm.
 */
export function useClipboardFix() {
  onMount(() => {
    const handleClipboard = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      // Skip if target is inside a terminal (xterm handles its own clipboard)
      const target = e.target as HTMLElement;
      if (target.closest('.xterm')) return;

      if (e.key === 'c' || e.key === 'x') {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const selectedText = selection.toString();
          if (selectedText) {
            e.preventDefault();
            await writeText(selectedText);
            // For cut, delete the selected content if in an editable field
            if (e.key === 'x' && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
              document.execCommand('delete');
            }
          }
        }
      } else if (e.key === 'v') {
        // Always intercept paste to use Tauri clipboard API.
        // This prevents WebKit's native NSPasteboard access which can crash
        // due to a macOS bug with stale clipboard type cache pointers.
        e.preventDefault();
        const text = await readText();
        if (text) {
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = target.selectionStart ?? 0;
            const end = target.selectionEnd ?? 0;
            const currentValue = target.value;
            // Use native input setter to trigger reactive frameworks
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
              'value'
            )?.set;
            nativeInputValueSetter?.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
            target.dispatchEvent(new Event('input', { bubbles: true }));
            // Restore cursor position after paste
            const newPos = start + text.length;
            target.setSelectionRange(newPos, newPos);
          } else if (target.isContentEditable) {
            // Handle contenteditable elements (e.g., code editors)
            document.execCommand('insertText', false, text);
          } else {
            // For any other focusable element, dispatch a paste-like event
            // so downstream handlers can pick it up if needed
            target.dispatchEvent(new CustomEvent('tauri-paste', { detail: text, bubbles: true }));
          }
        }
      } else if (e.key === 'a') {
        // Cmd+A: select all in input fields (ensure it works)
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          // Let native behavior handle it
          return;
        }
      }
    };

    // Intercept native paste events (from Edit menu, context menu, execCommand)
    // to prevent WebKit's NSPasteboard access which can crash on macOS.
    const handleNativePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Skip terminals (xterm handles its own clipboard)
      if (target.closest('.xterm')) return;

      e.preventDefault();
      e.stopPropagation();

      // Get text from the clipboard event data if available, otherwise use Tauri API
      let text = e.clipboardData?.getData('text/plain');
      if (!text) {
        text = await readText();
      }
      if (!text) return;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        const currentValue = target.value;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeInputValueSetter?.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
        target.dispatchEvent(new Event('input', { bubbles: true }));
        const newPos = start + text.length;
        target.setSelectionRange(newPos, newPos);
      } else if (target.isContentEditable) {
        document.execCommand('insertText', false, text);
      }
    };

    document.addEventListener('keydown', handleClipboard);
    document.addEventListener('paste', handleNativePaste, true); // capture phase
    onCleanup(() => {
      document.removeEventListener('keydown', handleClipboard);
      document.removeEventListener('paste', handleNativePaste, true);
    });
  });
}
