import { For } from 'solid-js';
import type { WizardData } from '../OnboardingWizard';
import { THEMES, type ThemeId, themeManager } from '../../../services/ThemeManager';

interface ThemeSelectionStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function ThemeSelectionStep(props: ThemeSelectionStepProps) {
  const handleThemeSelect = (themeId: ThemeId) => {
    props.onDataChange({ theme: themeId });
    // Apply theme immediately for live preview
    themeManager.setTheme(themeId);
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Select the appearance you prefer. You can change this anytime from Settings.
        </p>
      </div>

      {/* Theme Grid */}
      <div class="grid grid-cols-2 gap-4 mb-6">
        <For each={THEMES}>
          {(theme) => (
            <button
              class={`p-6 rounded-lg border-2 transition-all text-left ${
                props.data.theme === theme.id
                  ? 'border-zed-accent-blue bg-zed-accent-blue/10'
                  : 'border-zed-border-default hover:border-zed-border-focus bg-zed-bg-surface'
              }`}
              onClick={() => handleThemeSelect(theme.id)}
            >
              {/* Theme Preview */}
              <div class="mb-4">
                <ThemePreview themeId={theme.id} />
              </div>

              {/* Theme Info */}
              <div class="flex items-center gap-2 mb-2">
                <span class="text-base font-semibold text-zed-text-primary">{theme.name}</span>
                {props.data.theme === theme.id && (
                  <svg class="w-5 h-5 text-zed-accent-blue" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                )}
              </div>
              <p class="text-sm text-zed-text-tertiary">{theme.description}</p>
            </button>
          )}
        </For>
      </div>

      {/* Tutorial Content */}
      <div class="bg-zed-bg-hover p-4 rounded-lg">
        <h3 class="font-semibold text-zed-text-primary mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>Customization</span>
        </h3>
        <p class="text-sm text-zed-text-secondary pl-8">
          Codelane supports multiple editor themes with syntax highlighting.
          The theme applies to the entire interface including the terminal,
          editor, and UI panels.
        </p>
        <p class="text-sm text-zed-text-tertiary mt-2 pl-8">
          📚 Explore more themes: Settings → Appearance → Theme
        </p>
      </div>
    </div>
  );
}

// Theme preview component
function ThemePreview(props: { themeId: ThemeId }) {
  const colors = getThemeColors(props.themeId);

  return (
    <div
      class="h-24 rounded-md overflow-hidden border"
      style={{
        'background-color': colors.bg,
        'border-color': colors.border
      }}
    >
      {/* Mini window chrome */}
      <div
        class="h-6 flex items-center gap-1.5 px-3"
        style={{ 'background-color': colors.panel }}
      >
        <div class="w-2 h-2 rounded-full" style={{ 'background-color': colors.red }} />
        <div class="w-2 h-2 rounded-full" style={{ 'background-color': colors.yellow }} />
        <div class="w-2 h-2 rounded-full" style={{ 'background-color': colors.green }} />
      </div>
      {/* Content area */}
      <div class="flex h-18">
        {/* Sidebar */}
        <div
          class="w-10"
          style={{ 'background-color': colors.panel }}
        />
        {/* Editor area */}
        <div class="flex-1 p-2">
          <div class="h-1.5 w-12 rounded-sm mb-1.5" style={{ 'background-color': colors.accent }} />
          <div class="h-1.5 w-16 rounded-sm mb-1.5" style={{ 'background-color': colors.text }} />
          <div class="h-1.5 w-10 rounded-sm" style={{ 'background-color': colors.textMuted }} />
        </div>
      </div>
    </div>
  );
}

// Get colors for theme preview
function getThemeColors(themeId: ThemeId) {
  switch (themeId) {
    case 'codelane-dark':
      return {
        bg: '#1e1e1e',
        panel: '#252526',
        border: '#3e3e42',
        text: '#cccccc',
        textMuted: '#6a6a6a',
        accent: '#4ec9b0',
        red: '#e74856',
        yellow: '#f9f1a5',
        green: '#16c60c',
      };
    case 'dark':
      return {
        bg: '#0d1117',
        panel: '#161b22',
        border: '#30363d',
        text: '#c9d1d9',
        textMuted: '#8b949e',
        accent: '#58a6ff',
        red: '#ff5f56',
        yellow: '#ffbd2e',
        green: '#27c93f',
      };
    case 'light':
      return {
        bg: '#ffffff',
        panel: '#f6f8fa',
        border: '#d0d7de',
        text: '#24292f',
        textMuted: '#57606a',
        accent: '#0969da',
        red: '#ff5f56',
        yellow: '#ffbd2e',
        green: '#27c93f',
      };
    default:
      return {
        bg: '#0d1117',
        panel: '#161b22',
        border: '#30363d',
        text: '#c9d1d9',
        textMuted: '#8b949e',
        accent: '#58a6ff',
        red: '#ff5f56',
        yellow: '#ffbd2e',
        green: '#27c93f',
      };
  }
}
