// Appearance Settings Tab

import { For } from 'solid-js';
import { themeManager, THEMES, type ThemeId } from '../../services/ThemeManager';

export function AppearanceSettings() {
  const currentTheme = themeManager.getTheme();

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Appearance</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Customize the look and feel of Codelane.
      </p>

      <div class="space-y-6">
        {/* Theme Selection */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-3">Theme</h3>
          <div class="grid grid-cols-3 gap-3">
            <For each={THEMES}>
              {(theme) => (
                <button
                  class={`p-4 rounded-lg border-2 transition-all text-left ${
                    currentTheme() === theme.id
                      ? 'border-zed-accent-blue bg-zed-accent-blue/10'
                      : 'border-zed-border-default hover:border-zed-border-focus bg-zed-bg-surface'
                  }`}
                  onClick={() => themeManager.setTheme(theme.id)}
                >
                  {/* Theme Preview */}
                  <div class="mb-3">
                    <ThemePreview themeId={theme.id} />
                  </div>

                  {/* Theme Info */}
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-medium text-zed-text-primary">{theme.name}</span>
                    {currentTheme() === theme.id && (
                      <svg class="w-4 h-4 text-zed-accent-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p class="text-xs text-zed-text-tertiary">{theme.description}</p>
                </button>
              )}
            </For>
          </div>
        </div>

      </div>
    </div>
  );
}

// Theme preview component showing a mini representation of the theme
function ThemePreview(props: { themeId: ThemeId }) {
  const colors = getThemeColors(props.themeId);

  return (
    <div
      class="h-16 rounded-md overflow-hidden border"
      style={{
        'background-color': colors.bg,
        'border-color': colors.border
      }}
    >
      {/* Mini window chrome */}
      <div
        class="h-4 flex items-center gap-1 px-2"
        style={{ 'background-color': colors.panel }}
      >
        <div class="w-1.5 h-1.5 rounded-full" style={{ 'background-color': colors.red }} />
        <div class="w-1.5 h-1.5 rounded-full" style={{ 'background-color': colors.yellow }} />
        <div class="w-1.5 h-1.5 rounded-full" style={{ 'background-color': colors.green }} />
      </div>
      {/* Content area */}
      <div class="flex h-12">
        {/* Sidebar */}
        <div
          class="w-6"
          style={{ 'background-color': colors.panel }}
        />
        {/* Editor area */}
        <div class="flex-1 p-1.5">
          <div class="h-1 w-8 rounded-sm mb-1" style={{ 'background-color': colors.accent }} />
          <div class="h-1 w-12 rounded-sm mb-1" style={{ 'background-color': colors.text }} />
          <div class="h-1 w-6 rounded-sm" style={{ 'background-color': colors.textMuted }} />
        </div>
      </div>
    </div>
  );
}

// Get colors for theme preview
function getThemeColors(themeId: ThemeId) {
  switch (themeId) {
    case 'dark':
      return {
        bg: '#0a0a0a',
        panel: '#111111',
        border: '#252525',
        text: '#e6e6e6',
        textMuted: '#6e6e6e',
        accent: '#0b93f6',
        red: '#f23c3c',
        yellow: '#f5c249',
        green: '#26d97f',
      };
    case 'codelane-dark':
      return {
        bg: '#202329',
        panel: '#262a32',
        border: '#383c46',
        text: '#bbbfc3',
        textMuted: '#92979a',
        accent: '#5d8bba',
        red: '#a65b5f',
        yellow: '#b39a6a',
        green: '#819a67',
      };
    case 'light':
      return {
        bg: '#ffffff',
        panel: '#f8f9fa',
        border: '#dadce0',
        text: '#202124',
        textMuted: '#80868b',
        accent: '#1a73e8',
        red: '#d93025',
        yellow: '#f9ab00',
        green: '#188038',
      };
  }
}
