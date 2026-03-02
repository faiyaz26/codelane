import { onMount } from 'solid-js';

/**
 * Disables right-click context menu in production.
 */
export function useGlobalContextMenuFix() {
  onMount(() => {
    if (!import.meta.env.DEV) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  });
}
