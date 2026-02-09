/**
 * Git type definitions matching the Rust backend
 */

export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unknown';
}

export interface GitStatusResult {
  branch: string | null;
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranchInfo {
  current: string | null;
  branches: string[];
}

export interface FileChangeStats {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'typechange' | 'unknown';
  additions: number;
  deletions: number;
}
