// Editor Settings Manager - handles editor preferences and persistence

import { createSignal, createRoot, type Accessor } from 'solid-js';

export type MarkdownDefaultMode = 'preview' | 'source';
export type DiffViewDefaultMode = 'unified' | 'split';

export interface EditorSettings {
  markdownDefaultMode: MarkdownDefaultMode;
  diffViewDefaultMode: DiffViewDefaultMode;
}

const DEFAULT_SETTINGS: EditorSettings = {
  markdownDefaultMode: 'preview',
  diffViewDefaultMode: 'unified',
};

const STORAGE_KEY = 'codelane-editor-settings';

// Create reactive state within a root to ensure proper SolidJS reactivity
const { settings, setSettings } = createRoot(() => {
  const [settings, setSettings] = createSignal<EditorSettings>(DEFAULT_SETTINGS);
  return { settings, setSettings };
});

function loadSettings(): EditorSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new settings added later
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load editor settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(newSettings: EditorSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  } catch (e) {
    console.warn('Failed to save editor settings:', e);
  }
}

function updateSettings(partial: Partial<EditorSettings>) {
  const current = settings();
  const updated = { ...current, ...partial };
  setSettings(updated);
  saveSettings(updated);
}

// Initialize settings on module load
setSettings(loadSettings());

// Export editor settings manager API
export const editorSettingsManager = {
  getSettings(): Accessor<EditorSettings> {
    return settings;
  },

  getMarkdownDefaultMode(): MarkdownDefaultMode {
    return settings().markdownDefaultMode;
  },

  setMarkdownDefaultMode(mode: MarkdownDefaultMode) {
    updateSettings({ markdownDefaultMode: mode });
  },

  getDiffViewDefaultMode(): DiffViewDefaultMode {
    return settings().diffViewDefaultMode;
  },

  setDiffViewDefaultMode(mode: DiffViewDefaultMode) {
    updateSettings({ diffViewDefaultMode: mode });
  },
};
