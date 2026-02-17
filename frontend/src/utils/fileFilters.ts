/**
 * File Filters for Code Review
 *
 * Determines which files should be included/excluded from AI code review.
 * Uses configurable categories from CodeReviewSettings.
 */

import type { FileExclusionCategories } from '../services/CodeReviewSettingsManager';

/**
 * File categories with their associated patterns
 */
const FILE_CATEGORIES = {
  documentation: {
    extensions: ['.md', '.txt', '.rst', '.adoc', '.asciidoc'],
    patterns: [/README/, /CHANGELOG/, /LICENSE/, /CONTRIBUTING/],
  },
  lockFiles: {
    extensions: ['.lock', '-lock.json', '-lock.yaml'],
    filenames: [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Cargo.lock',
      'Gemfile.lock',
      'poetry.lock',
      'composer.lock',
      'go.sum',
    ],
  },
  generatedFiles: {
    extensions: ['.min.js', '.min.css', '.bundle.js', '.chunk.js', '.map'],
    patterns: [/\.generated\./, /\.g\./, /__generated__/],
  },
  binaryFiles: {
    extensions: [
      '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
      '.mp4', '.mp3', '.wav', '.avi',
      '.pdf', '.doc', '.docx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
    ],
  },
  testFiles: {
    extensions: ['.test.ts', '.test.js', '.spec.ts', '.spec.js', '.test.tsx', '.spec.tsx'],
    patterns: [/__tests__\//, /__mocks__\//, /\.test\./, /\.spec\./],
  },
  configFiles: {
    filenames: [
      'tsconfig.json',
      'jsconfig.json',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.prettierrc',
      '.prettierrc.js',
      '.editorconfig',
      'jest.config.js',
      'vite.config.ts',
      'webpack.config.js',
      'rollup.config.js',
    ],
    extensions: ['.config.js', '.config.ts', '.config.mjs'],
  },
};

/**
 * Always excluded directories (regardless of settings)
 */
const ALWAYS_EXCLUDED_DIRS = [
  /node_modules\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.nuxt\//,
  /\.cache\//,
  /coverage\//,
  /\.git\//,
  /target\//,
  /out\//,
  /\.vscode\//,
  /\.idea\//,
];

/**
 * Check if a file matches a category
 */
function matchesCategory(
  filePath: string,
  category: keyof typeof FILE_CATEGORIES
): boolean {
  const normalizedPath = filePath.toLowerCase();
  const fileName = filePath.split('/').pop() || '';
  const categoryDef = FILE_CATEGORIES[category];

  // Check extensions
  if (categoryDef.extensions) {
    for (const ext of categoryDef.extensions) {
      if (normalizedPath.endsWith(ext.toLowerCase())) {
        return true;
      }
    }
  }

  // Check exact filenames
  if (categoryDef.filenames) {
    if (categoryDef.filenames.some(name => fileName === name)) {
      return true;
    }
  }

  // Check patterns
  if (categoryDef.patterns) {
    for (const pattern of categoryDef.patterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a file should be reviewed based on settings
 */
export function shouldReviewFile(
  filePath: string,
  excludeCategories: FileExclusionCategories,
  customExcludePatterns: string[] = []
): boolean {
  const normalizedPath = filePath.toLowerCase();

  // Always exclude certain directories
  for (const pattern of ALWAYS_EXCLUDED_DIRS) {
    if (pattern.test(normalizedPath)) {
      return false;
    }
  }

  // Check each enabled exclusion category
  for (const [category, enabled] of Object.entries(excludeCategories)) {
    if (enabled && matchesCategory(filePath, category as keyof typeof FILE_CATEGORIES)) {
      return false;
    }
  }

  // Check custom exclude patterns (glob-like)
  for (const pattern of customExcludePatterns) {
    const regex = new RegExp(
      pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    if (regex.test(filePath)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter a list of file paths to only reviewable files
 */
export function filterReviewableFiles<T extends { path: string }>(
  files: T[],
  excludeCategories: FileExclusionCategories,
  customExcludePatterns: string[] = []
): T[] {
  return files.filter(file =>
    shouldReviewFile(file.path, excludeCategories, customExcludePatterns)
  );
}

/**
 * Get a summary of excluded files
 */
export function getExclusionSummary<T extends { path: string }>(
  files: T[],
  excludeCategories: FileExclusionCategories,
  customExcludePatterns: string[] = []
): { total: number; excluded: number; files: string[] } {
  const excludedFiles = files.filter(
    f => !shouldReviewFile(f.path, excludeCategories, customExcludePatterns)
  );

  return {
    total: files.length,
    excluded: excludedFiles.length,
    files: excludedFiles.map(f => f.path),
  };
}

/**
 * Get human-readable reason for exclusion
 */
export function getExclusionReason(
  filePath: string,
  excludeCategories: FileExclusionCategories
): string | null {
  const normalizedPath = filePath.toLowerCase();

  // Check always-excluded directories
  for (const pattern of ALWAYS_EXCLUDED_DIRS) {
    if (pattern.test(normalizedPath)) {
      return 'File is in excluded directory';
    }
  }

  // Check each category
  if (excludeCategories.documentation && matchesCategory(filePath, 'documentation')) {
    return 'Documentation file';
  }
  if (excludeCategories.lockFiles && matchesCategory(filePath, 'lockFiles')) {
    return 'Lock file (auto-generated)';
  }
  if (excludeCategories.generatedFiles && matchesCategory(filePath, 'generatedFiles')) {
    return 'Generated/minified file';
  }
  if (excludeCategories.binaryFiles && matchesCategory(filePath, 'binaryFiles')) {
    return 'Binary/media file';
  }
  if (excludeCategories.testFiles && matchesCategory(filePath, 'testFiles')) {
    return 'Test file';
  }
  if (excludeCategories.configFiles && matchesCategory(filePath, 'configFiles')) {
    return 'Configuration file';
  }

  return null;
}
