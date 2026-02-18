/**
 * Changeset Checksum Utilities
 *
 * Generates checksums for changesets to reliably detect when files have changed.
 * Uses a simple deterministic string based on sorted file paths.
 */

import type { FileChangeStats } from '../types/git';

/**
 * Compute a checksum for a list of file changes
 * Returns a deterministic string that represents the changeset
 */
export function computeChangesetChecksum(files: FileChangeStats[]): string {
  // Sort files by path to ensure deterministic ordering
  const sortedPaths = files.map(f => f.path).sort();

  // Create a simple checksum by joining paths
  // Format: "path1|path2|path3"
  return sortedPaths.join('|');
}

/**
 * Compare two checksums for equality
 */
export function checksumsMatch(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return a === b;
}
