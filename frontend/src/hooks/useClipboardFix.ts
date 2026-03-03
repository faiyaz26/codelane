import { onMount, onCleanup } from 'solid-js';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';

/**
 * Global clipboard handler (copy/paste/cut) using Tauri clipboard API.
 * Tauri webviews don't support native clipboard shortcuts natively well in all contexts,
 * so we handle them globally here. Terminal has its own clipboard handling via xterm.
 */
export function useClipboardFix() {
  onMount(() => {
    /**
     * Intercept keyboard shortcuts for Copy/Cut/SelectAll.
     * Paste (Cmd+V) is intentionally handled via the 'paste' event (handleNativePaste)
     * to avoid double-pasting and ensure compatibility with Edit menu actions.
     */
    const handleKeyboardShortcuts = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      const target = e.target as HTMLElement;
      // Skip if target is inside a terminal (xterm handles its own clipboard)
      if (target?.closest?.('.xterm')) return;

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
      } else if (e.key === 'a') {
        // Cmd+A: ensure it works in input fields
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          // Let native behavior handle it
          return;
        }
      }
      // Note: 'v' is NOT handled here to prevent double-pasting. 
      // Most browsers trigger a 'paste' event even when Cmd+V is prevented on keydown,
      // or they trigger 'paste' if we don't prevent it.
    };

    /**
     * Intercept native paste events (from Cmd+V, Edit menu, context menu).
     * We use the Tauri clipboard API to prevent WebKit's native NSPasteboard access 
     * which can crash on macOS due to stale pointer bugs.
     */
    const handleNativePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Skip terminals (xterm handles its own clipboard)
      if (target?.closest?.('.xterm')) return;

      // Prevent the native paste action
      e.preventDefault();
      e.stopPropagation();

      // Read text from Tauri clipboard API (more reliable than event.clipboardData in this context)
      const text = await readText();
      if (!text) return;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        const currentValue = target.value;
        
        // Use native input setter to trigger reactive frameworks (Solid/React)
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        )?.set;
        
        nativeInputValueSetter?.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
        
        // Trigger input event so the framework knows the value changed
        target.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Restore/set cursor position after paste
        const newPos = start + text.length;
        target.setSelectionRange(newPos, newPos);
      } else if (target instanceof HTMLElement && target.isContentEditable) {
        // Handle contenteditable elements
        document.execCommand('insertText', false, text);
      } else if (target instanceof HTMLElement) {
        // For any other focusable element, dispatch a custom event
        target.dispatchEvent(new CustomEvent('tauri-paste', { detail: text, bubbles: true }));
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    document.addEventListener('paste', handleNativePaste, true); // capture phase
    
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
      document.removeEventListener('paste', handleNativePaste, true);
    });
  });
}
