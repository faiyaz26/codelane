// Editor module types

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

  return shikiMap[language] || 'text';
}
