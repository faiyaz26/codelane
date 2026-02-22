import { describe, it, expect } from 'vitest';
import {
  parseFileReviewWithAnnotations,
  parseBatchedReviewWithAnnotations,
} from '../annotationParser';

describe('annotationParser', () => {
  describe('parseFileReviewWithAnnotations', () => {
    it('parses mixed general feedback and annotations', () => {
      const response = `- Variable naming could be improved
- Good use of async/await

[L42]: Unused variable \`temp\` should be removed
[L78:warning]: Potential null dereference here`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.generalFeedback).toBe(
        '- Variable naming could be improved\n- Good use of async/await'
      );
      expect(result.annotations).toHaveLength(2);
      expect(result.annotations[0]).toEqual({
        line: 42,
        severity: 'info',
        comment: 'Unused variable `temp` should be removed',
      });
      expect(result.annotations[1]).toEqual({
        line: 78,
        severity: 'warning',
        comment: 'Potential null dereference here',
      });
    });

    it('returns all content as feedback when no annotations present', () => {
      const response = `- Good code structure
- Consider adding tests`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.generalFeedback).toBe(response);
      expect(result.annotations).toHaveLength(0);
    });

    it('handles response with only annotations', () => {
      const response = `[L10]: Missing return type
[L25:error]: SQL injection vulnerability
[L100:warning]: Consider memoizing this value`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.generalFeedback).toBe('');
      expect(result.annotations).toHaveLength(3);
      expect(result.annotations[0].severity).toBe('info');
      expect(result.annotations[1].severity).toBe('error');
      expect(result.annotations[2].severity).toBe('warning');
    });

    it('handles multi-digit line numbers', () => {
      const response = `[L1234]: Large line number annotation`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].line).toBe(1234);
    });

    it('handles empty response', () => {
      const result = parseFileReviewWithAnnotations('');

      expect(result.generalFeedback).toBe('');
      expect(result.annotations).toHaveLength(0);
    });

    it('preserves blank lines in general feedback', () => {
      const response = `First paragraph

Second paragraph

[L5]: An annotation`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.generalFeedback).toBe('First paragraph\n\nSecond paragraph');
      expect(result.annotations).toHaveLength(1);
    });

    it('does not match malformed annotation lines', () => {
      const response = `[L]: missing line number
[42]: missing L prefix
L42: missing brackets
[L42] missing colon after bracket
Regular text with [L42]: embedded`;

      const result = parseFileReviewWithAnnotations(response);

      expect(result.annotations).toHaveLength(0);
      expect(result.generalFeedback).toContain('[L]: missing line number');
    });
  });

  describe('parseBatchedReviewWithAnnotations', () => {
    it('parses single file response', () => {
      const response = `- Good code
[L10]: Consider renaming`;

      const results = parseBatchedReviewWithAnnotations(response, ['src/index.ts']);

      expect(results.size).toBe(1);
      const parsed = results.get('src/index.ts')!;
      expect(parsed.generalFeedback).toBe('- Good code');
      expect(parsed.annotations).toHaveLength(1);
      expect(parsed.annotations[0].line).toBe(10);
    });

    it('parses multi-file batched response with file markers', () => {
      const response = `## File: src/a.ts
- Changes look good
[L5]: Unused import

## File: src/b.ts
- Needs refactoring
[L20:error]: Memory leak in event listener`;

      const results = parseBatchedReviewWithAnnotations(response, [
        'src/a.ts',
        'src/b.ts',
      ]);

      expect(results.size).toBe(2);

      const a = results.get('src/a.ts')!;
      expect(a.generalFeedback).toBe('- Changes look good');
      expect(a.annotations).toHaveLength(1);
      expect(a.annotations[0].line).toBe(5);

      const b = results.get('src/b.ts')!;
      expect(b.generalFeedback).toBe('- Needs refactoring');
      expect(b.annotations).toHaveLength(1);
      expect(b.annotations[0].severity).toBe('error');
    });

    it('falls back to full response for single file when no markers', () => {
      const response = `Some feedback
[L1]: annotation`;

      const results = parseBatchedReviewWithAnnotations(response, ['only-file.ts']);

      expect(results.size).toBe(1);
      const parsed = results.get('only-file.ts')!;
      expect(parsed.annotations).toHaveLength(1);
    });
  });
});
