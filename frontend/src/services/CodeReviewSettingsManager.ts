/**
 * Code Review Settings Manager
 *
 * Handles persistence of code review preferences (AI tool, model, prompts).
 * Follows EditorSettingsManager pattern: localStorage + reactive SolidJS signals.
 */

import { createSignal, createRoot, type Accessor } from 'solid-js';
import type { AITool } from './AIReviewService';

export interface CodeReviewSettings {
  aiTool: AITool;
  aiModel: Record<AITool, string>;
  reviewPrompt: string | null;  // null = use default
  filePrompt: string | null;    // null = use default
}

const DEFAULT_SETTINGS: CodeReviewSettings = {
  aiTool: 'claude',
  aiModel: {
    claude: 'haiku',
    aider: 'gpt-4o-mini',
    opencode: 'gpt-4o-mini',
    gemini: 'gemini-2.0-flash-exp',
  },
  reviewPrompt: null,
  filePrompt: null,
};

const STORAGE_KEY = 'codelane-code-review-settings';

// Legacy keys to migrate from
const LEGACY_AI_TOOL_KEY = 'codelane:aiTool';
const LEGACY_AI_MODEL_PREFIX = 'codelane:aiModel:';

const { settings, setSettings } = createRoot(() => {
  const [settings, setSettings] = createSignal<CodeReviewSettings>(DEFAULT_SETTINGS);
  return { settings, setSettings };
});

function migrateLegacyKeys(): Partial<CodeReviewSettings> {
  const migrated: Partial<CodeReviewSettings> = {};

  try {
    const legacyTool = localStorage.getItem(LEGACY_AI_TOOL_KEY);
    if (legacyTool && ['claude', 'aider', 'opencode', 'gemini'].includes(legacyTool)) {
      migrated.aiTool = legacyTool as AITool;
    }

    const tools: AITool[] = ['claude', 'aider', 'opencode', 'gemini'];
    const models: Record<string, string> = {};
    let hasModels = false;
    for (const tool of tools) {
      const model = localStorage.getItem(`${LEGACY_AI_MODEL_PREFIX}${tool}`);
      if (model) {
        models[tool] = model;
        hasModels = true;
      }
    }
    if (hasModels) {
      migrated.aiModel = { ...DEFAULT_SETTINGS.aiModel, ...models } as Record<AITool, string>;
    }
  } catch (e) {
    console.warn('Failed to migrate legacy AI settings:', e);
  }

  return migrated;
}

function loadSettings(): CodeReviewSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }

    // Try migrating from legacy keys
    const migrated = migrateLegacyKeys();
    if (Object.keys(migrated).length > 0) {
      const merged = { ...DEFAULT_SETTINGS, ...migrated };
      saveSettings(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load code review settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(newSettings: CodeReviewSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  } catch (e) {
    console.warn('Failed to save code review settings:', e);
  }
}

function updateSettings(partial: Partial<CodeReviewSettings>) {
  const current = settings();
  const updated = { ...current, ...partial };
  setSettings(updated);
  saveSettings(updated);
}

// Initialize on module load
setSettings(loadSettings());

export const codeReviewSettingsManager = {
  getSettings(): Accessor<CodeReviewSettings> {
    return settings;
  },

  getAITool(): AITool {
    return settings().aiTool;
  },

  setAITool(tool: AITool) {
    updateSettings({ aiTool: tool });
  },

  getAIModel(tool?: AITool): string {
    const t = tool || settings().aiTool;
    return settings().aiModel[t];
  },

  setAIModel(tool: AITool, model: string) {
    const current = settings().aiModel;
    updateSettings({ aiModel: { ...current, [tool]: model } });
  },

  getReviewPrompt(): string | null {
    return settings().reviewPrompt;
  },

  setReviewPrompt(prompt: string | null) {
    updateSettings({ reviewPrompt: prompt });
  },

  getFilePrompt(): string | null {
    return settings().filePrompt;
  },

  setFilePrompt(prompt: string | null) {
    updateSettings({ filePrompt: prompt });
  },

  getDefaults(): CodeReviewSettings {
    return { ...DEFAULT_SETTINGS };
  },
};
