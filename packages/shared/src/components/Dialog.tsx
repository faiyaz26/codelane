import { Dialog as KobalteDialog } from '@kobalte/core/dialog';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: any;
}

export function Dialog(props: DialogProps) {
  return (
    <KobalteDialog open={props.open} onOpenChange={props.onOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content class="relative w-full max-w-lg bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-6">
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

            {props.title && (
              <KobalteDialog.Title class="text-lg font-semibold text-zed-text-primary mb-2">
                {props.title}
              </KobalteDialog.Title>
            )}
            {props.description && (
              <KobalteDialog.Description class="text-sm text-zed-text-secondary mb-4">
                {props.description}
              </KobalteDialog.Description>
            )}
            <div>{props.children}</div>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
