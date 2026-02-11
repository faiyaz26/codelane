// About Dialog - Shows app information and version

import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import codelaneLogoWhite from '../assets/codelane-logo-white.png';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog(props: AboutDialogProps) {
  return (
    <KobalteDialog open={props.open} onOpenChange={props.onOpenChange}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content class="relative w-full max-w-md bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl overflow-hidden">
            {/* Content */}
            <div class="p-8 text-center">
              {/* Logo */}
              <div class="mb-6 flex justify-center">
                <img src={codelaneLogoWhite} alt="Codelane" class="w-16 h-16 object-contain" />
              </div>

              {/* App Name */}
              <h1 class="text-2xl font-bold text-zed-text-primary mb-2">Codelane</h1>

              {/* Version */}
              <p class="text-sm text-zed-text-secondary mb-6">Version 0.1.0</p>

              {/* Description */}
              <p class="text-sm text-zed-text-secondary mb-6 leading-relaxed">
                Professional development environment featuring multi-lane project management, AI-powered code review, integrated terminals, and intelligent git workflows.
              </p>

              {/* Links */}
              <div class="flex flex-col gap-2 mb-6">
                <a
                  href="https://github.com/faiyaz26/codelane"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-zed-accent-blue hover:text-zed-accent-blue-hover transition-colors flex items-center justify-center gap-2"
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clip-rule="evenodd" />
                  </svg>
                  GitHub Repository
                </a>
                <a
                  href="https://github.com/faiyaz26/codelane/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-zed-text-tertiary hover:text-zed-text-secondary transition-colors"
                >
                  Report an Issue
                </a>
              </div>

              {/* Tech Stack */}
              <div class="pt-4 border-t border-zed-border-subtle">
                <p class="text-xs text-zed-text-disabled mb-2">Built with</p>
                <div class="flex items-center justify-center gap-3 text-xs text-zed-text-tertiary">
                  <span>Tauri</span>
                  <span>•</span>
                  <span>SolidJS</span>
                  <span>•</span>
                  <span>Rust</span>
                </div>
              </div>

              {/* Copyright */}
              <p class="text-xs text-zed-text-disabled mt-6">
                © 2025 Codelane. MIT License.
              </p>
            </div>

            {/* Close Button */}
            <KobalteDialog.CloseButton class="absolute top-4 right-4 rounded-md p-1 hover:bg-zed-bg-hover transition-colors">
              <svg class="h-5 w-5 text-zed-text-tertiary hover:text-zed-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </KobalteDialog.CloseButton>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
