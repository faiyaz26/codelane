// General Settings Tab

import { createSignal, onMount } from 'solid-js';
import { editorSettingsManager, type MarkdownDefaultMode, type DiffViewDefaultMode } from '../../services/EditorSettingsManager';

export type FileSortOrder = 'alphabetical' | 'smart' | 'smart-dependencies' | 'change-size' | 'none';

export function GeneralSettings() {
  const settings = editorSettingsManager.getSettings();
  const [fileSortOrder, setFileSortOrder] = createSignal<FileSortOrder>('smart');

  // Load file sort order from localStorage
  onMount(() => {
    const saved = localStorage.getItem('codelane:fileSortOrder');
    if (saved && ['alphabetical', 'smart', 'smart-dependencies', 'change-size', 'none'].includes(saved)) {
      setFileSortOrder(saved as FileSortOrder);
    }
  });

  const handleMarkdownModeChange = (mode: MarkdownDefaultMode) => {
    editorSettingsManager.setMarkdownDefaultMode(mode);
  };

  const handleDiffViewModeChange = (mode: DiffViewDefaultMode) => {
    editorSettingsManager.setDiffViewDefaultMode(mode);
  };

  const handleFileSortOrderChange = (order: FileSortOrder) => {
    setFileSortOrder(order);
    localStorage.setItem('codelane:fileSortOrder', order);
    // Emit event so other components can react
    window.dispatchEvent(new CustomEvent('fileSortOrderChanged', { detail: order }));
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

        {/* Git/Code Review Settings */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">Code Review</h3>

          {/* File Sort Order */}
          <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
            <div class="flex items-start justify-between">
              <div class="flex-1 mr-4">
                <p class="text-sm font-medium text-zed-text-primary">File Sort Order</p>
                <p class="text-xs text-zed-text-tertiary mt-1">
                  Choose how files are sorted in code review changes list
                </p>
              </div>
              <select
                class="px-3 py-2 text-sm rounded-md bg-zed-bg-panel border border-zed-border-default text-zed-text-primary focus:outline-none focus:ring-2 focus:ring-zed-accent-blue"
                value={fileSortOrder()}
                onChange={(e) => handleFileSortOrderChange(e.target.value as FileSortOrder)}
              >
                <option value="smart">Smart (Recommended)</option>
                <option value="smart-dependencies">Smart + Dependencies</option>
                <option value="alphabetical">Alphabetical</option>
                <option value="change-size">Change Size</option>
                <option value="none">Git Order (None)</option>
              </select>
            </div>
            <div class="mt-3 text-xs text-zed-text-disabled">
              {fileSortOrder() === 'smart' && (
                <p>
                  <strong class="text-zed-text-tertiary">Smart:</strong> Groups by category (config → types → implementation → tests → generated → docs) and pairs tests with their implementation files.
                </p>
              )}
              {fileSortOrder() === 'smart-dependencies' && (
                <p>
                  <strong class="text-zed-text-tertiary">Smart + Dependencies:</strong> Like Smart but also orders implementation files by their import dependencies using Tree-sitter (TypeScript, JavaScript, Python, Rust, Go). Files appear before the code that imports them.
                </p>
              )}
              {fileSortOrder() === 'alphabetical' && (
                <p>
                  <strong class="text-zed-text-tertiary">Alphabetical:</strong> Files sorted A-Z by path, similar to GitHub/GitLab.
                </p>
              )}
              {fileSortOrder() === 'change-size' && (
                <p>
                  <strong class="text-zed-text-tertiary">Change Size:</strong> Files with the most changes appear first, useful for focusing on large modifications.
                </p>
              )}
              {fileSortOrder() === 'none' && (
                <p>
                  <strong class="text-zed-text-tertiary">Git Order:</strong> Files in the order returned by git (no sorting).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
