/**
 * Git API - Wrapper around Tauri commands for git operations
 */

import { invoke } from '@tauri-apps/api/core';
import type { GitStatusResult, GitCommit, GitBranchInfo } from '../types/git';

/**
 * Get git status for a repository
 */
export async function getGitStatus(path: string): Promise<GitStatusResult> {
  return invoke<GitStatusResult>('git_status', { path });
}

/**
 * Get git diff for a file or entire repository
 */
export async function getGitDiff(
  path: string,
  file?: string,
  staged?: boolean
): Promise<string> {
  return invoke<string>('git_diff', { path, file, staged });
}

/**
 * Get commit log
 */
export async function getGitLog(path: string, count?: number): Promise<GitCommit[]> {
  return invoke<GitCommit[]>('git_log', { path, count });
}

/**
 * Get branch information
 */
export async function getGitBranch(path: string): Promise<GitBranchInfo> {
  return invoke<GitBranchInfo>('git_branch', { path });
}

/**
 * Stage files for commit
 */
export async function stageFiles(path: string, files: string[]): Promise<void> {
  return invoke<void>('git_stage', { path, files });
}

/**
 * Unstage files
 */
export async function unstageFiles(path: string, files: string[]): Promise<void> {
  return invoke<void>('git_unstage', { path, files });
}

/**
 * Create a commit
 */
export async function createCommit(path: string, message: string): Promise<string> {
  return invoke<string>('git_commit', { path, message });
}

/**
 * Discard changes in working directory
 */
export async function discardChanges(path: string, files: string[]): Promise<void> {
  return invoke<void>('git_discard', { path, files });
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(path: string): Promise<boolean> {
  return invoke<boolean>('git_is_repo', { path });
}

/**
 * Initialize a new git repository
 */
export async function initGitRepo(path: string): Promise<void> {
  return invoke<void>('git_init', { path });
}

/**
 * Check if a branch exists
 */
export async function branchExists(path: string, branch: string): Promise<boolean> {
  return invoke<boolean>('git_branch_exists', { path, branch });
}

/**
 * Create a new branch
 */
export async function createBranch(path: string, branch: string): Promise<void> {
  return invoke<void>('git_create_branch', { path, branch });
}

/**
 * Create a git worktree
 */
export async function createWorktree(
  path: string,
  worktreePath: string,
  branch: string
): Promise<void> {
  return invoke<void>('git_worktree_add', { path, worktreePath, branch });
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(path: string, worktreePath: string): Promise<void> {
  return invoke<void>('git_worktree_remove', { path, worktreePath });
}
