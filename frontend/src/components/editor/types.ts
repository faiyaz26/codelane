// Editor module types

// User-defined custom language configuration for uncommon syntaxes.
// Stored in EditorSettings.customLanguages (localStorage).
export interface CustomLanguageConfig {
  id: string;           // Stable key: preset IDs start with "preset-", user IDs are UUIDs
  name: string;         // Display name, e.g. "LookML"
  extensions: string[]; // File extensions without dot, e.g. ["lkml", "lookml"]
  aliasFor?: string;    // Use an existing Shiki language (e.g. "terraform"). Mutually exclusive with grammar.
  scopeName?: string;   // TextMate scope name, required when using grammar (e.g. "source.lookml")
  grammar?: string;     // TextMate grammar JSON string, for languages Shiki doesn't bundle
}

// Convert a language display name to a stable Shiki-safe slug for grammar-mode languages
export function customLangSlug(name: string): string {
  return 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Internal registry — updated by CustomLanguageManager when settings change.
// Using a module-level variable avoids threading the list through every call site.
let _customLangs: CustomLanguageConfig[] = [];

/** Called by CustomLanguageManager whenever the custom language list changes. */
export function _setCustomLanguages(langs: CustomLanguageConfig[]): void {
  _customLangs = langs;
}

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string | null;
  isLoading: boolean;
  isModified: boolean;
  error: string | null;
  language: string;
  scrollToLine?: number; // Line number to scroll to after loading (1-indexed)
  highlightMatch?: {
    line: number; // 1-indexed
    column: number;
    text: string;
  };
  forceSourceMode?: number; // For markdown files: timestamp to force source view (e.g., when opened from search)
  // External change tracking
  lastKnownModifiedTime?: number; // Unix timestamp when file was last loaded/saved
  hasExternalChanges?: boolean; // Flag set when external modification detected
  // Diff view mode
  diffContent?: string; // If set, show diff instead of regular content
  isDiffView?: boolean; // Flag to indicate this is a diff view
  // Temporary file mode
  isTemporary?: boolean; // Flag to indicate this is a temporary file (not saved to disk)
  isReadonly?: boolean; // Flag to indicate this file is read-only
}

// Check if a file is a markdown file
export function isMarkdownFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['md', 'mdx', 'markdown'].includes(ext);
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  isModified: boolean;
}

// Language detection based on file extension
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Check user-defined custom languages before built-in mappings
  for (const lang of _customLangs) {
    if (lang.extensions.includes(ext)) {
      return lang.aliasFor ?? customLangSlug(lang.name);
    }
  }

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascriptreact',
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'mjs': 'javascript',
    'cjs': 'javascript',

    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',

    // Data formats
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'toml': 'toml',

    // Programming languages
    'rs': 'rust',
    'py': 'python',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',

    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',

    // Config
    'md': 'markdown',
    'mdx': 'markdown',
    'txt': 'plaintext',
    'log': 'plaintext',
    'env': 'dotenv',
    'gitignore': 'gitignore',
    'dockerfile': 'dockerfile',

    // SQL
    'sql': 'sql',
  };

  // Special filenames
  const nameMap: Record<string, string> = {
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'cmakelists.txt': 'cmake',
    '.gitignore': 'gitignore',
    '.env': 'dotenv',
    '.env.local': 'dotenv',
    '.env.development': 'dotenv',
    '.env.production': 'dotenv',
  };

  const lowerName = filename.toLowerCase();
  if (nameMap[lowerName]) {
    return nameMap[lowerName];
  }

  return languageMap[ext] || 'plaintext';
}

// Get display name for language
export function getLanguageDisplayName(language: string): string {
  const displayNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'javascriptreact': 'JavaScript React',
    'typescript': 'TypeScript',
    'typescriptreact': 'TypeScript React',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'rust': 'Rust',
    'python': 'Python',
    'go': 'Go',
    'markdown': 'Markdown',
    'plaintext': 'Plain Text',
    'shell': 'Shell',
    'dockerfile': 'Dockerfile',
    'sql': 'SQL',
  };

  return displayNames[language] || language.charAt(0).toUpperCase() + language.slice(1);
}

// Map our language IDs to Shiki language IDs
export function getShikiLanguage(language: string): string {
  const shikiMap: Record<string, string> = {
    'javascript': 'javascript',
    'javascriptreact': 'jsx',
    'typescript': 'typescript',
    'typescriptreact': 'tsx',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'xml',
    'toml': 'toml',
    'rust': 'rust',
    'python': 'python',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'csharp': 'csharp',
    'ruby': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'scala': 'scala',
    'shell': 'shellscript',
    'markdown': 'markdown',
    'plaintext': 'text',
    'dotenv': 'dotenv',
    'gitignore': 'text',
    'dockerfile': 'dockerfile',
    'sql': 'sql',
    'makefile': 'makefile',
    'cmake': 'cmake',
  };

  return shikiMap[language] || language; // Unknown IDs pass through — Shiki handles them or falls back
}
