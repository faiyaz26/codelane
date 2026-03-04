import { Show, createMemo } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { dialogManager } from '../services/DialogManager';

export function DynamicExtensionDialog() {
  const activeDialog = dialogManager.getActiveDialog();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      dialogManager.close();
    }
  };

  const maxWidthClass = createMemo(() => {
    const size = activeDialog()?.size || 'md';
    switch (size) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case 'full': return 'max-w-[90vw]';
      default: return 'max-w-md';
    }
  });

  return (
    <KobalteDialog open={!!activeDialog()} onOpenChange={handleOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-[1001] flex items-center justify-center p-4">
          <KobalteDialog.Content class={`relative w-full ${maxWidthClass()} bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-6`}>
            <KobalteDialog.CloseButton class="absolute top-4 right-4 rounded-md p-1 hover:bg-zed-bg-hover transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-zed-text-tertiary hover:text-zed-text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </KobalteDialog.CloseButton>

            <Show when={activeDialog()?.title}>
              <KobalteDialog.Title class="text-lg font-semibold text-zed-text-primary mb-2">
                {activeDialog()?.title}
              </KobalteDialog.Title>
            </Show>
            
            <Show when={activeDialog()?.description}>
              <KobalteDialog.Description class="text-sm text-zed-text-secondary mb-4">
                {activeDialog()?.description}
              </KobalteDialog.Description>
            </Show>

            <div class="mt-2">
              <Show when={activeDialog()?.component}>
                {(content) => {
                  const comp = content();
                  if (comp instanceof HTMLElement) {
                    // For vanilla DOM elements from extensions
                    return <div ref={(el) => el.appendChild(comp)} />;
                  } else {
                    // For Solid components (if any)
                    return <Dynamic component={comp} {...(activeDialog()?.props || {})} />;
                  }
                }}
              </Show>
            </div>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
