// UpdateToast — bottom-right toast shown when a new version is available.
// Self-contained: reads from updaterService and needs no props.

import { Show } from 'solid-js';
import { updaterService } from '../services/UpdaterService';

export function UpdateToast() {
  const visible = () =>
    updaterService.status() === 'available' || updaterService.status() === 'downloading';

  return (
    <Show when={visible()}>
      <div class="fixed bottom-4 right-4 z-50 w-80 animate-slide-up">
        <div class="bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div class="flex items-center justify-between px-4 pt-4 pb-2">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-zed-accent-blue flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v4.59L7.3 9.24a.75.75 0 00-1.1 1.02l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75z" clip-rule="evenodd" />
              </svg>
              <span class="text-sm font-semibold text-zed-text-primary">Update Available</span>
            </div>
            <Show when={updaterService.status() === 'available'}>
              <button
                onClick={() => updaterService.dismiss(true)}
                class="text-zed-text-disabled hover:text-zed-text-primary transition-colors cursor-pointer select-none"
                aria-label="Dismiss"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </Show>
          </div>

          {/* Body */}
          <div class="px-4 pb-4">
            <p class="text-sm text-zed-text-secondary mb-3">
              Codelane <span class="font-medium text-zed-text-primary">{updaterService.updateVersion()}</span> is ready to install.
            </p>

            {/* Download action or progress bar */}
            <Show
              when={updaterService.status() === 'downloading'}
              fallback={
                <div class="flex items-center gap-2">
                  <button
                    onClick={() => updaterService.downloadAndInstall()}
                    class="flex-1 px-3 py-1.5 bg-zed-accent-blue hover:bg-zed-accent-blue-hover text-white text-sm rounded transition-colors font-medium cursor-pointer select-none"
                  >
                    Download & Install
                  </button>
                  <button
                    onClick={() => updaterService.dismiss(true)}
                    class="px-3 py-1.5 text-sm text-zed-text-tertiary hover:text-zed-text-secondary transition-colors cursor-pointer select-none"
                  >
                    Later
                  </button>
                </div>
              }
            >
              <div>
                <div class="flex justify-between text-xs text-zed-text-secondary mb-1.5">
                  <span>Downloading…</span>
                  <span>{updaterService.downloadProgress()}%</span>
                </div>
                <div class="w-full bg-zed-bg-app rounded-full h-1">
                  <div
                    class="bg-zed-accent-blue h-1 rounded-full transition-all duration-200"
                    style={{ width: `${updaterService.downloadProgress()}%` }}
                  />
                </div>
                <p class="text-xs text-zed-text-disabled mt-1.5">App will restart automatically when done.</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
