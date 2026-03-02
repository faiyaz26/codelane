import { onMount, onCleanup } from 'solid-js';

/**
 * Disables autocomplete, autocorrect, and spellcheck on all inputs globally.
 */
export function useInputFeaturesFix() {
  onMount(() => {
    const disableInputFeatures = (element: Element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.setAttribute('autocomplete', 'off');
        element.setAttribute('autocorrect', 'off');
        element.setAttribute('autocapitalize', 'off');
        element.setAttribute('spellcheck', 'false');
      }
    };

    // Apply to all existing inputs
    document.querySelectorAll('input, textarea').forEach(disableInputFeatures);

    // Watch for new inputs added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches('input, textarea')) {
              disableInputFeatures(node);
            }
            node.querySelectorAll('input, textarea').forEach(disableInputFeatures);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    onCleanup(() => observer.disconnect());
  });
}
