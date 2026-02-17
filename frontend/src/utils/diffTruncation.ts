/**
 * Smart Diff Truncation
 *
 * For large diffs that would exceed model context limits, extract "interesting parts"
 * without using LLM: file metadata, function signatures, imports, key changes.
 */

export interface DiffTruncationOptions {
  maxLines?: number;        // Max lines before truncation (default: 500)
  maxBytes?: number;        // Max bytes before truncation (default: 50KB)
  linesPerHunk?: number;    // Lines to show per hunk (default: 5)
}

const DEFAULT_OPTIONS: Required<DiffTruncationOptions> = {
  maxLines: 500,
  maxBytes: 50 * 1024, // 50KB
  linesPerHunk: 5,
};

interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  hunks: number;
}

/**
 * Check if a diff needs truncation
 */
export function shouldTruncateDiff(diff: string, options?: DiffTruncationOptions): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lineCount = diff.split('\n').length;
  const byteSize = new Blob([diff]).size;

  return lineCount > opts.maxLines || byteSize > opts.maxBytes;
}

/**
 * Extract stats from a diff
 */
function extractDiffStats(diff: string): DiffStats {
  const lines = diff.split('\n');
  let linesAdded = 0;
  let linesRemoved = 0;
  let hunks = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++;
    } else if (line.startsWith('@@')) {
      hunks++;
    }
  }

  return { linesAdded, linesRemoved, hunks };
}

/**
 * Extract interesting lines from diff (function/class signatures, imports, exports)
 */
function extractInterestingLines(lines: string[]): string[] {
  const interesting: string[] = [];
  const patterns = [
    /^[+-]\s*(import|export|from)\s+/,           // Imports/exports
    /^[+-]\s*(function|const|let|var)\s+\w+/,    // Function declarations
    /^[+-]\s*(class|interface|type|enum)\s+\w+/, // Type declarations
    /^[+-]\s*(public|private|protected|async)\s+/, // Method modifiers
    /^[+-]\s*\w+\s*\([^)]*\)\s*{/,               // Function calls
    /^[+-].*\bexport\s+(default|const|function|class)/, // Exports
  ];

  for (const line of lines) {
    // Skip diff metadata
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      continue;
    }

    // Check if line matches any interesting pattern
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        interesting.push(line);
        break;
      }
    }
  }

  return interesting;
}

/**
 * Truncate a large diff to "interesting parts"
 */
export function truncateLargeDiff(
  filePath: string,
  diff: string,
  options?: DiffTruncationOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines = diff.split('\n');
  const stats = extractDiffStats(diff);

  // Extract metadata (file headers)
  const metadata: string[] = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].startsWith('diff ') || lines[i].startsWith('index ') ||
        lines[i].startsWith('---') || lines[i].startsWith('+++')) {
      metadata.push(lines[i]);
    }
  }

  // Extract interesting lines (imports, function signatures, etc.)
  const interestingLines = extractInterestingLines(lines);

  // Extract first N lines of each hunk
  const hunkPreviews: string[] = [];
  let inHunk = false;
  let hunkLineCount = 0;
  let currentHunkLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Save previous hunk if exists
      if (currentHunkLines.length > 0) {
        hunkPreviews.push(...currentHunkLines);
      }
      // Start new hunk
      inHunk = true;
      hunkLineCount = 0;
      currentHunkLines = [line];
    } else if (inHunk && hunkLineCount < opts.linesPerHunk) {
      currentHunkLines.push(line);
      hunkLineCount++;
    } else if (inHunk && hunkLineCount >= opts.linesPerHunk) {
      // End of hunk preview
      if (!currentHunkLines.some(l => l.includes('...'))) {
        currentHunkLines.push('    ... (truncated)');
      }
      inHunk = false;
    }
  }

  // Add last hunk
  if (currentHunkLines.length > 0) {
    hunkPreviews.push(...currentHunkLines);
  }

  // Build truncated diff
  const truncated: string[] = [
    '# FILE TRUNCATED (too large for full analysis)',
    `# File: ${filePath}`,
    `# Stats: +${stats.linesAdded} -${stats.linesRemoved} lines across ${stats.hunks} hunks`,
    `# Original size: ${lines.length} lines (truncated to save tokens)`,
    '',
    '## Metadata',
    ...metadata,
    '',
  ];

  if (interestingLines.length > 0) {
    truncated.push(
      '## Key Changes (imports, functions, types)',
      ...interestingLines.slice(0, 30), // Limit to 30 most interesting lines
      '',
    );
  }

  truncated.push(
    '## Hunk Previews (first few lines of each change)',
    ...hunkPreviews,
    '',
    `# NOTE: This diff was truncated. Review focuses on structure and key changes.`,
    `# For detailed line-by-line review, examine the file directly.`,
  );

  return truncated.join('\n');
}

/**
 * Process a diff map, truncating large diffs
 */
export function processDiffsWithTruncation(
  fileDiffs: Map<string, string>,
  options?: DiffTruncationOptions
): Map<string, string> {
  const processed = new Map<string, string>();

  for (const [filePath, diff] of fileDiffs.entries()) {
    if (shouldTruncateDiff(diff, options)) {
      processed.set(filePath, truncateLargeDiff(filePath, diff, options));
    } else {
      processed.set(filePath, diff);
    }
  }

  return processed;
}

/**
 * Get a summary of truncation actions
 */
export function getTruncationSummary(
  fileDiffs: Map<string, string>,
  options?: DiffTruncationOptions
): { total: number; truncated: number; files: string[] } {
  const truncatedFiles: string[] = [];

  for (const [filePath, diff] of fileDiffs.entries()) {
    if (shouldTruncateDiff(diff, options)) {
      truncatedFiles.push(filePath);
    }
  }

  return {
    total: fileDiffs.size,
    truncated: truncatedFiles.length,
    files: truncatedFiles,
  };
}
