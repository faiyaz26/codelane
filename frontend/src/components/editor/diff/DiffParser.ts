// Git diff parser - converts git diff output to structured data

import type { ParsedDiff, DiffHunk, ParsedDiffLine } from './types';

/**
 * Parse git diff output into structured hunks
 */
export function parseDiff(diffText: string): ParsedDiff {
  const lines = diffText.split('\n').filter((line) => {
    // Filter out git metadata headers
    return (
      !line.startsWith('diff --git') &&
      !line.startsWith('index ') &&
      !line.startsWith('--- ') &&
      !line.startsWith('+++ ')
    );
  });

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);

    if (hunkMatch) {
      // Save previous hunk if exists
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      // Parse hunk header
      const oldStart = parseInt(hunkMatch[1]);
      const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
      const newStart = parseInt(hunkMatch[3]);
      const newLines = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;
      const headerRest = hunkMatch[5] || '';

      // Initialize new hunk
      currentHunk = {
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };

      // Reset line numbers for this hunk
      oldLineNum = oldStart;
      newLineNum = newStart;

      // Add header as a line
      currentHunk.lines.push({
        content: line,
        type: 'header',
      });
    } else if (currentHunk) {
      // Parse diff lines
      let type: ParsedDiffLine['type'] = 'context';
      let oldLine: number | undefined = oldLineNum;
      let newLine: number | undefined = newLineNum;

      if (line.startsWith('+')) {
        type = 'added';
        oldLine = undefined;
        newLine = newLineNum++;
        additions++;
      } else if (line.startsWith('-')) {
        type = 'removed';
        oldLine = oldLineNum++;
        newLine = undefined;
        deletions++;
      } else {
        // Context line
        type = 'context';
        oldLine = oldLineNum++;
        newLine = newLineNum++;
      }

      currentHunk.lines.push({
        content: line,
        type,
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      });
    }
  }

  // Add last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    hunks,
    additions,
    deletions,
  };
}

/**
 * Extract code content from a diff line (remove +/- prefix)
 */
export function extractCodeContent(line: string): string {
  if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
    return line.slice(1);
  }
  return line;
}

/**
 * Parse hunk header to extract line numbers
 */
export function parseHunkHeader(header: string): {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
} | null {
  const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1]),
    oldLines: match[2] ? parseInt(match[2]) : 1,
    newStart: parseInt(match[3]),
    newLines: match[4] ? parseInt(match[4]) : 1,
  };
}
