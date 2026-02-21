/**
 * Review File Processor
 *
 * Handles file operations for code review:
 * - Fetching changed files with stats
 * - Fetching file diffs
 * - Sorting files
 *
 * Pure async functions with no state management.
 */

import { getChangesWithStats, getGitDiff, getBranchChangesWithStats, getBranchDiff } from '../../lib/git-api';
import { reviewAPI } from '../api/provider';
import type { FileChangeStats } from '../../types/git';

export class ReviewFileProcessor {
  /**
   * Fetch changed files with line statistics
   */
  async fetchChangesWithStats(workingDir: string): Promise<FileChangeStats[]> {
    return getChangesWithStats(workingDir);
  }

  /**
   * Fetch diffs for changed files
   * Can fetch all diffs eagerly or return empty map for lazy loading
   *
   * Options:
   * - eager: true (default) - fetch all diffs upfront
   * - eager: false - return empty map (diffs loaded on demand via useLazyDiff)
   * - topN: number - fetch only top N files (useful for summaries)
   *
   * Returns a map of file path -> diff content
   */
  async fetchFileDiffs(
    workingDir: string,
    files: FileChangeStats[],
    options?: { eager?: boolean; topN?: number; signal?: AbortSignal }
  ): Promise<Map<string, string>> {
    const fileDiffs = new Map<string, string>();

    // If eager is false, return empty map (will be loaded on demand)
    if (options?.eager === false) {
      return fileDiffs;
    }

    // Determine which files to fetch
    const filesToFetch = options?.topN ? files.slice(0, options.topN) : files;

    for (const file of filesToFetch) {
      // Check abort signal
      if (options?.signal?.aborted) {
        break;
      }

      try {
        const diff = await getGitDiff(workingDir, file.path, false);
        if (diff && diff.trim()) {
          fileDiffs.set(file.path, diff);
        }
      } catch {
        // Skip files that can't be diffed (binary, etc.)
      }
    }

    return fileDiffs;
  }

  /**
   * Sort files using smart ordering algorithm
   * Falls back to original order if sorting fails
   */
  async sortFiles(
    files: FileChangeStats[],
    workingDir: string
  ): Promise<FileChangeStats[]> {
    try {
      const sortedFiles = await reviewAPI.sortFiles({
        files,
        sortOrder: 'smart',
        workingDir,
      });
      return sortedFiles;
    } catch {
      // Fallback to original order if sorting fails
      return files;
    }
  }

  /**
   * Fetch changed files between a base branch and HEAD with line statistics
   */
  async fetchBranchChangesWithStats(
    workingDir: string,
    baseBranch: string,
  ): Promise<FileChangeStats[]> {
    return getBranchChangesWithStats(workingDir, baseBranch);
  }

  /**
   * Fetch diff for a specific file between a base branch and HEAD
   */
  async fetchBranchFileDiff(
    workingDir: string,
    baseBranch: string,
    file: string,
  ): Promise<string> {
    return getBranchDiff(workingDir, baseBranch, file);
  }

  /**
   * Fetch diffs for branch changes (base...HEAD)
   */
  async fetchBranchDiffs(
    workingDir: string,
    files: FileChangeStats[],
    baseBranch: string,
    options?: { topN?: number; signal?: AbortSignal },
  ): Promise<Map<string, string>> {
    const fileDiffs = new Map<string, string>();

    const filesToFetch = options?.topN ? files.slice(0, options.topN) : files;

    for (const file of filesToFetch) {
      if (options?.signal?.aborted) {
        break;
      }

      try {
        const diff = await getBranchDiff(workingDir, baseBranch, file.path);
        if (diff && diff.trim()) {
          fileDiffs.set(file.path, diff);
        }
      } catch {
        // Skip files that can't be diffed
      }
    }

    return fileDiffs;
  }
}

// Export singleton instance
export const reviewFileProcessor = new ReviewFileProcessor();
