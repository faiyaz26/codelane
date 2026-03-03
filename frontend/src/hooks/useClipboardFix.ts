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
     * Intercept keyboard shortcuts for Copy/Cut/SelectAll/Paste.
     */
    const handleKeyboardShortcuts = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      const target = e.target as HTMLElement;
      // Skip if target is inside a terminal (xterm handles its own clipboard)
      if (
        target?.closest?.('.xterm') || 
        target?.classList?.contains('xterm') ||
        target?.classList?.contains('xterm-helper-textarea') ||
        target?.closest?.('.xterm-helper-textarea') ||
        (target?.className && typeof target.className === 'string' && target.className.includes('xterm')) ||
        (target?.closest && target.closest('[class*="xterm"]'))
      ) return;

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
        // ALWAYS prevent default for Cmd+V.
        // If we don't, the browser will perform a native paste AND also 
        // trigger a 'paste' event which we also handle, leading to double-paste.
        e.preventDefault();
        e.stopPropagation();
        
        // Manual paste trigger
        handleManualPaste(target);
      } else if (e.key === 'a') {
        // Cmd+A: ensure it works in input fields
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          // Let native behavior handle it
          return;
        }
      }
    };

    /**
     * Common paste logic used by both keyboard shortcut and native paste event.
     */
    const handleManualPaste = async (target: HTMLElement) => {
      if (!target) return;
      
      try {
        // Read text from Tauri clipboard API
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
          
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(target, currentValue.slice(0, start) + text + currentValue.slice(end));
          } else {
            target.value = currentValue.slice(0, start) + text + currentValue.slice(end);
          }
          
          // Trigger input event so the framework knows the value changed
          target.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Restore/set cursor position after paste
          const newPos = start + text.length;
          target.setSelectionRange(newPos, newPos);
        } else if (target instanceof HTMLElement && target.isContentEditable) {
          document.execCommand('insertText', false, text);
        } else if (target instanceof HTMLElement) {
          target.dispatchEvent(new CustomEvent('tauri-paste', { detail: text, bubbles: true }));
        }
      } catch (error) {
        console.error('[ClipboardFix] CRITICAL ERROR during paste operation:', error);
      }
    };

    /**
     * Intercept native paste events (from Edit menu, context menu).
     * We use the Tauri clipboard API to prevent WebKit's native NSPasteboard access 
     * which can crash on macOS due to stale pointer bugs.
     */
    const handleNativePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Skip terminals (xterm handles its own clipboard)
      if (
        target?.closest?.('.xterm') || 
        target?.classList?.contains('xterm') ||
        target?.classList?.contains('xterm-helper-textarea') ||
        target?.closest?.('.xterm-helper-textarea') ||
        (target?.className && typeof target.className === 'string' && target.className.includes('xterm')) ||
        (target?.closest && target.closest('[class*="xterm"]'))
      ) return;

      // Prevent the native paste action
      e.preventDefault();
      e.stopPropagation();

      // Handle the paste
      handleManualPaste(target);
    };

    document.addEventListener('keydown', handleKeyboardShortcuts, true); // capture phase
    document.addEventListener('paste', handleNativePaste, true); // capture phase
    
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyboardShortcuts, true);
      document.removeEventListener('paste', handleNativePaste, true);
    });
  });
}
