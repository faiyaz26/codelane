/**
 * Review API Tests
 *
 * Demonstrates how to use MockReviewAPI for testing.
 */

import { describe, it, expect } from 'vitest';
import { MockReviewAPI, FailingMockReviewAPI } from '../MockReviewAPI';
import type { ReviewGenerationParams, FileReviewParams, SortFilesParams } from '../types';

describe('MockReviewAPI', () => {
  const mockAPI = new MockReviewAPI();

  it('should generate a mock review', async () => {
    const params: ReviewGenerationParams = {
      tool: 'claude',
      diffContent: 'mock diff content',
      prompt: 'test prompt',
      workingDir: '/test/dir',
      model: 'haiku',
    };

    const result = await mockAPI.generateReview(params);

    expect(result.success).toBe(true);
    expect(result.content).toContain('Mock Review');
    expect(result.content).toContain('claude');
    expect(result.error).toBeUndefined();
  });

  it('should generate a mock file review', async () => {
    const params: FileReviewParams = {
      tool: 'aider',
      filePath: 'src/test.ts',
      diffContent: 'mock diff content',
      workingDir: '/test/dir',
      model: 'gpt-4o-mini',
      customPrompt: 'Review this file',
    };

    const result = await mockAPI.generateFileReview(params);

    expect(result.success).toBe(true);
    expect(result.content).toContain('src/test.ts');
    expect(result.error).toBeUndefined();
  });

  it('should sort files by size', async () => {
    const params: SortFilesParams = {
      files: [
        { path: 'a.ts', status: 'modified', additions: 10, deletions: 5 },
        { path: 'b.ts', status: 'modified', additions: 50, deletions: 20 },
        { path: 'c.ts', status: 'modified', additions: 5, deletions: 2 },
      ],
      sortOrder: 'smart',
      workingDir: '/test/dir',
    };

    const result = await mockAPI.sortFiles(params);

    // Mock sorts by size (additions + deletions)
    expect(result[0].path).toBe('b.ts'); // 70 total
    expect(result[1].path).toBe('a.ts'); // 15 total
    expect(result[2].path).toBe('c.ts'); // 7 total
  });

  it('should test tool availability', async () => {
    const result = await mockAPI.testTool({ tool: 'claude' });
    expect(result).toBe(true);
  });

  it('should get available tools', async () => {
    const result = await mockAPI.getAvailableTools();
    expect(result).toContain('claude');
    expect(result).toContain('aider');
    expect(result).toContain('opencode');
    expect(result).toContain('gemini');
  });

  it('should allow configuring delay', async () => {
    mockAPI.setDelay(10);

    const start = Date.now();
    await mockAPI.testTool({ tool: 'claude' });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(10);
  });
});

describe('FailingMockReviewAPI', () => {
  const failingAPI = new FailingMockReviewAPI();

  it('should return error for generateReview', async () => {
    const params: ReviewGenerationParams = {
      tool: 'claude',
      diffContent: 'mock diff content',
      prompt: 'test prompt',
      workingDir: '/test/dir',
    };

    const result = await failingAPI.generateReview(params);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Mock error');
  });

  it('should return error for generateFileReview', async () => {
    const params: FileReviewParams = {
      tool: 'claude',
      filePath: 'src/test.ts',
      diffContent: 'mock diff content',
      workingDir: '/test/dir',
    };

    const result = await failingAPI.generateFileReview(params);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Mock error');
  });

  it('should return unsorted files for sortFiles', async () => {
    const files = [
      { path: 'a.ts', status: 'modified' as const, additions: 10, deletions: 5 },
      { path: 'b.ts', status: 'modified' as const, additions: 50, deletions: 20 },
    ];

    const params: SortFilesParams = {
      files,
      sortOrder: 'smart',
      workingDir: '/test/dir',
    };

    const result = await failingAPI.sortFiles(params);

    // Returns unsorted (original order)
    expect(result).toEqual(files);
  });

  it('should return false for testTool', async () => {
    const result = await failingAPI.testTool({ tool: 'claude' });
    expect(result).toBe(false);
  });

  it('should return empty array for getAvailableTools', async () => {
    const result = await failingAPI.getAvailableTools();
    expect(result).toEqual([]);
  });
});
