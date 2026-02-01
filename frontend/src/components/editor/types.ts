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
