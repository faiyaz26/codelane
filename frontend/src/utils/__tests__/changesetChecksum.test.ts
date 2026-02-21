import { describe, it, expect } from 'vitest';
import { computeChangesetChecksum, checksumsMatch } from '../changesetChecksum';
import type { FileChangeStats } from '../../types/git';

const makeFile = (path: string, added = 0, deleted = 0): FileChangeStats => ({
  path,
  status: 'modified',
  added,
  deleted,
});

describe('changesetChecksum', () => {
  describe('computeChangesetChecksum', () => {
    it('produces deterministic checksum for same files regardless of order', () => {
      const files1 = [makeFile('b.ts'), makeFile('a.ts')];
      const files2 = [makeFile('a.ts'), makeFile('b.ts')];

      expect(computeChangesetChecksum(files1)).toBe(computeChangesetChecksum(files2));
    });

    it('produces different checksum when file list changes', () => {
      const before = [makeFile('a.ts'), makeFile('b.ts')];
      const after = [makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts')];

      expect(computeChangesetChecksum(before)).not.toBe(computeChangesetChecksum(after));
    });

    it('produces different checksum when a file is removed', () => {
      const before = [makeFile('a.ts'), makeFile('b.ts')];
      const after = [makeFile('a.ts')];

      expect(computeChangesetChecksum(before)).not.toBe(computeChangesetChecksum(after));
    });

    it('handles empty file list', () => {
      expect(computeChangesetChecksum([])).toBe('');
    });

    it('handles single file', () => {
      expect(computeChangesetChecksum([makeFile('src/index.ts')])).toBe('src/index.ts');
    });
  });

  describe('checksumsMatch', () => {
    it('returns true for matching checksums', () => {
      expect(checksumsMatch('a|b', 'a|b')).toBe(true);
    });

    it('returns false for different checksums', () => {
      expect(checksumsMatch('a|b', 'a|b|c')).toBe(false);
    });

    it('returns false when either is null', () => {
      expect(checksumsMatch(null, 'a')).toBe(false);
      expect(checksumsMatch('a', null)).toBe(false);
      expect(checksumsMatch(null, null)).toBe(false);
    });
  });

  describe('PR review staleness detection', () => {
    it('detects stale review when branch has new files after pull', () => {
      const reviewedFiles = [makeFile('src/a.ts'), makeFile('src/b.ts')];
      const reviewedChecksum = computeChangesetChecksum(reviewedFiles);

      // After pulling, branch has a new file
      const currentFiles = [makeFile('src/a.ts'), makeFile('src/b.ts'), makeFile('src/c.ts')];
      const currentChecksum = computeChangesetChecksum(currentFiles);

      expect(checksumsMatch(currentChecksum, reviewedChecksum)).toBe(false);
    });

    it('does not flag stale when branch is unchanged after pull', () => {
      const reviewedFiles = [makeFile('src/a.ts'), makeFile('src/b.ts')];
      const reviewedChecksum = computeChangesetChecksum(reviewedFiles);

      // After pulling, same files
      const currentFiles = [makeFile('src/b.ts'), makeFile('src/a.ts')]; // different order
      const currentChecksum = computeChangesetChecksum(currentFiles);

      expect(checksumsMatch(currentChecksum, reviewedChecksum)).toBe(true);
    });

    it('detects stale when file is removed from branch', () => {
      const reviewedFiles = [makeFile('a.ts'), makeFile('b.ts'), makeFile('c.ts')];
      const reviewedChecksum = computeChangesetChecksum(reviewedFiles);

      const currentFiles = [makeFile('a.ts'), makeFile('c.ts')];
      const currentChecksum = computeChangesetChecksum(currentFiles);

      expect(checksumsMatch(currentChecksum, reviewedChecksum)).toBe(false);
    });
  });
});
