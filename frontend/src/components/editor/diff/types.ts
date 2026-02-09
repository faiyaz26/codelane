// Diff viewer type definitions

export interface ParsedDiffLine {
  content: string;
  type: 'added' | 'removed' | 'context' | 'header';
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedDiffLine[];
}

export interface ParsedDiff {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface ExpandedContext {
  lines: string[];
  startLineNum: number;
}

export type DiffViewMode = 'unified' | 'split';
