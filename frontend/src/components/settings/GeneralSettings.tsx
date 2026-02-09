// General Settings Tab

import { editorSettingsManager, type MarkdownDefaultMode, type DiffViewDefaultMode } from '../../services/EditorSettingsManager';

export function GeneralSettings() {
  const settings = editorSettingsManager.getSettings();

  const handleMarkdownModeChange = (mode: MarkdownDefaultMode) => {
    editorSettingsManager.setMarkdownDefaultMode(mode);
  };

  const handleDiffViewModeChange = (mode: DiffViewDefaultMode) => {
    editorSettingsManager.setDiffViewDefaultMode(mode);
  };

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">General Settings</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Configure general application settings.
      </p>

      <div class="space-y-6">
        {/* Editor Settings */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">Editor</h3>

          {/* Markdown Default Mode */}
          <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-zed-text-primary">Markdown Default Mode</p>
                <p class="text-xs text-zed-text-tertiary mt-1">
                  Choose how markdown files open by default
                </p>
              </div>
              <div class="flex items-center gap-1 p-1 bg-zed-bg-panel rounded-md border border-zed-border-default">
                <button
                  class={`px-3 py-1.5 text-sm rounded transition-colors ${
                    settings().markdownDefaultMode === 'preview'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover'
                  }`}
                  onClick={() => handleMarkdownModeChange('preview')}
                >
                  Live Preview
                </button>
                <button
                  class={`px-3 py-1.5 text-sm rounded transition-colors ${
                    settings().markdownDefaultMode === 'source'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover'
                  }`}
                  onClick={() => handleMarkdownModeChange('source')}
                >
                  Source
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Diff Viewer Settings */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">Diff Viewer</h3>

          {/* Default View Mode */}
          <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-zed-text-primary">Default View Mode</p>
                <p class="text-xs text-zed-text-tertiary mt-1">
                  Choose how diff views open by default
                </p>
              </div>
              <div class="flex items-center gap-1 p-1 bg-zed-bg-panel rounded-md border border-zed-border-default">
                <button
                  class={`px-3 py-1.5 text-sm rounded transition-colors ${
                    settings().diffViewDefaultMode === 'unified'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover'
                  }`}
                  onClick={() => handleDiffViewModeChange('unified')}
                >
                  Unified
                </button>
                <button
                  class={`px-3 py-1.5 text-sm rounded transition-colors ${
                    settings().diffViewDefaultMode === 'split'
                      ? 'bg-zed-accent-blue text-white'
                      : 'text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover'
                  }`}
                  onClick={() => handleDiffViewModeChange('split')}
                >
                  Split
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
