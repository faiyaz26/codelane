/**
 * Code Review Settings Manager
 *
 * Handles persistence of code review preferences (prompts, concurrency, file exclusions).
 * The AI tool is derived from the main agent configured in Settings > Agents.
 */

import { createSignal, createRoot, type Accessor } from 'solid-js';

export interface FileExclusionCategories {
  documentation: boolean;     // .md, .txt, .rst, .adoc
  lockFiles: boolean;         // package-lock.json, yarn.lock, Cargo.lock, etc.
  generatedFiles: boolean;    // .min.js, .bundle.js, .chunk.js
  binaryFiles: boolean;       // images, fonts, archives
  testFiles: boolean;         // *.test.ts, *.spec.js, __tests__/
  configFiles: boolean;       // tsconfig.json, .eslintrc, etc.
}

export const DEFAULT_REVIEW_PROMPT = `You are an expert code analyst performing a thorough code review. Analyze these changes and provide a structured review.

## Output Format (use exact headings)

### Summary
Brief overview of what changed and why (2-3 sentences).

### Key Changes
- Bullet points of the main modifications across all files

### Concerns
- Potential issues, bugs, security vulnerabilities, or areas needing attention
- Include severity (low/medium/high) for each concern

### Suggestions
- Specific, actionable improvements or recommendations
- Reference file paths and line numbers when possible

### Positive Notes
- What was done well, good patterns observed

Be concise but thorough. Focus on actionable, specific feedback rather than generic advice.`;

export const DEFAULT_FILE_PROMPT = `Analyze the changes in this file and provide brief, focused feedback.

Include:
1. What changed and why (1-2 sentences)
2. Any concerns (bugs, security, performance)
3. Specific suggestions for improvement

Be very concise — aim for 3-5 bullet points total. No preamble.

## Line Annotations

After your general feedback, add line-specific annotations for important issues.
Use this exact format, one per line (referencing NEW file line numbers from the diff):

[L<line_number>]: <concise comment>
[L<line_number>:warning]: <comment for warnings>
[L<line_number>:error]: <comment for errors/bugs>

Only annotate lines with genuine issues — focus on the 2-5 most important ones.`;

export interface CodeReviewSettings {
  reviewModel: string | null;   // null = use tool's default model
  reviewPrompt: string;         // Always populated with the prompt to use
  filePrompt: string;           // Always populated with the prompt to use
  concurrency: number;           // Number of files to process in parallel (1-8)
  excludeCategories: FileExclusionCategories; // File categories to exclude from review
  customExcludePatterns: string[]; // Custom glob patterns to exclude (e.g., "*.generated.ts")
}

const DEFAULT_SETTINGS: CodeReviewSettings = {
  reviewModel: null,
  reviewPrompt: DEFAULT_REVIEW_PROMPT,
  filePrompt: DEFAULT_FILE_PROMPT,
  concurrency: 4,
  excludeCategories: {
    documentation: true,
    lockFiles: true,
    generatedFiles: true,
    binaryFiles: true,
    testFiles: false,
    configFiles: false,
  },
  customExcludePatterns: [],
};

const STORAGE_KEY = 'codelane-code-review-settings';

const { settings, setSettings } = createRoot(() => {
  const [settings, setSettings] = createSignal<CodeReviewSettings>(DEFAULT_SETTINGS);
  return { settings, setSettings };
});

function loadSettings(): CodeReviewSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      // Migrate: fill in prompts that were previously null
      if (!merged.reviewPrompt) merged.reviewPrompt = DEFAULT_REVIEW_PROMPT;
      if (!merged.filePrompt) merged.filePrompt = DEFAULT_FILE_PROMPT;
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

  getReviewModel(): string | null {
    return settings().reviewModel;
  },

  setReviewModel(model: string | null) {
    updateSettings({ reviewModel: model });
  },

  getReviewPrompt(): string {
    return settings().reviewPrompt;
  },

  setReviewPrompt(prompt: string) {
    updateSettings({ reviewPrompt: prompt });
  },

  getFilePrompt(): string {
    return settings().filePrompt;
  },

  setFilePrompt(prompt: string) {
    updateSettings({ filePrompt: prompt });
  },

  getConcurrency(): number {
    return settings().concurrency;
  },

  setConcurrency(concurrency: number) {
    const clamped = Math.max(1, Math.min(8, concurrency));
    updateSettings({ concurrency: clamped });
  },

  getExcludeCategories(): FileExclusionCategories {
    return settings().excludeCategories;
  },

  setExcludeCategory(category: keyof FileExclusionCategories, enabled: boolean) {
    const current = settings().excludeCategories;
    updateSettings({ excludeCategories: { ...current, [category]: enabled } });
  },

  getCustomExcludePatterns(): string[] {
    return settings().customExcludePatterns;
  },

  addCustomExcludePattern(pattern: string) {
    const current = settings().customExcludePatterns;
    if (!current.includes(pattern)) {
      updateSettings({ customExcludePatterns: [...current, pattern] });
    }
  },

  removeCustomExcludePattern(pattern: string) {
    const current = settings().customExcludePatterns;
    updateSettings({ customExcludePatterns: current.filter(p => p !== pattern) });
  },

  getDefaults(): CodeReviewSettings {
    return { ...DEFAULT_SETTINGS };
  },
};
