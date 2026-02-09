// DiffExpansion - handles fetching and managing expanded context

import { getFileAtRevision } from '../../../lib/git-api';
import type { DiffHunk, ExpandedContext } from './types';

/**
 * Fetch expanded context for a hunk
 * Shows N lines above the hunk
 */
export async function fetchExpandedContext(
  workingDir: string,
  filePath: string,
  hunk: DiffHunk,
  linesToShow: number = 5
): Promise<ExpandedContext | null> {
  try {
    // Fetch file content at HEAD
    const content = await getFileAtRevision(workingDir, filePath, 'HEAD');
    const fileLines = content.split('\n');

    const startLine = hunk.newStart;

    if (startLine <= 1) {
      // No lines to expand above
      return null;
    }

    // Show N lines before this hunk (or fewer if not available)
    const actualLinesToShow = Math.min(linesToShow, startLine - 1);
    const startIdx = startLine - actualLinesToShow - 1; // -1 for 0-indexed
    const endIdx = startLine - 1; // -1 for 0-indexed

    const expandedLines = fileLines.slice(startIdx, endIdx);
    const startLineNum = startIdx + 1; // Convert to 1-indexed for display

    return {
      lines: expandedLines,
      startLineNum,
    };
  } catch (err) {
    console.error('Failed to fetch expanded context:', err);
    return null;
  }
}
