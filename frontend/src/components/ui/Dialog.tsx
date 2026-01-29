import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { ParentComponent } from 'solid-js';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
}

export const Dialog: ParentComponent<DialogProps> = (props) => {
  return (
    <KobalteDialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <KobalteDialog.Content class="relative z-50 w-full max-w-lg bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95">
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
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog.Root>
  );
};

export const DialogTrigger = KobalteDialog.Trigger;
