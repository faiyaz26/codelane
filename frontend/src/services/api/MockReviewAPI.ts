/**
 * Mock Review API Implementation
 *
 * Mock implementation for testing and development without Tauri runtime.
 */

import type { IReviewAPI } from './ReviewAPI';
import type {
  ReviewGenerationParams,
  FileReviewParams,
  SortFilesParams,
  TestToolParams,
  AIReviewResult,
  FileChangeStats,
} from './types';
import type { AITool } from '../AIReviewService';

/**
 * Mock Review API
 *
 * Returns realistic mock data for all operations.
 * Useful for testing components without Tauri backend.
 */
export class MockReviewAPI implements IReviewAPI {
  private delay = 300; // Simulate network delay

  /**
   * Set artificial delay for mock responses (in ms)
   */
  setDelay(ms: number): void {
    this.delay = ms;
  }

  private async wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.delay));
  }

  async generateReview(params: ReviewGenerationParams): Promise<AIReviewResult> {
    await this.wait();

    return {
      success: true,
      content: `## Mock Review for ${params.tool}

### Summary
This is a mock AI review generated for testing purposes. The actual review would analyze the code changes and provide detailed feedback.

### Key Changes
- Mock change 1: Updated function implementation
- Mock change 2: Added new error handling
- Mock change 3: Refactored data structures

### Concerns
- **Medium**: Consider adding unit tests for the new functionality
- **Low**: Variable naming could be more descriptive in some places

### Suggestions
1. Add comprehensive error handling for edge cases
2. Consider extracting complex logic into separate functions
3. Document public APIs with JSDoc comments

### Positive Notes
- Good separation of concerns
- Clean code structure
- Follows project conventions

Model: ${params.model || 'default'}
Working Directory: ${params.workingDir}`,
      error: undefined,
    };
  }

  async generateFileReview(params: FileReviewParams): Promise<AIReviewResult> {
    await this.wait();

    return {
      success: true,
      content: `### ${params.filePath}

**What Changed:**
Mock analysis of changes in this file. This would normally contain specific insights about the modifications.

**Concerns:**
- Potential edge case not handled around line 45
- Consider null checks for the new parameters

**Suggestions:**
- Add unit tests for the new functionality
- Consider extracting the validation logic into a separate function

Model: ${params.model || 'default'}`,
      error: undefined,
    };
  }

  async sortFiles(params: SortFilesParams): Promise<FileChangeStats[]> {
    await this.wait();

    // Mock sorting by additions + deletions (descending)
    return [...params.files].sort((a, b) => {
      const sizeA = a.additions + a.deletions;
      const sizeB = b.additions + b.deletions;
      return sizeB - sizeA;
    });
  }

  async testTool(params: TestToolParams): Promise<boolean> {
    await this.wait();

    // Mock: all tools are available in test environment
    return true;
  }

  async getAvailableTools(): Promise<AITool[]> {
    await this.wait();

    // Mock: all tools available
    return ['claude', 'aider', 'opencode', 'gemini'];
  }
}

/**
 * Mock Review API that simulates errors
 *
 * Useful for testing error handling scenarios.
 */
export class FailingMockReviewAPI implements IReviewAPI {
  async generateReview(_params: ReviewGenerationParams): Promise<AIReviewResult> {
    return {
      success: false,
      content: '',
      error: 'Mock error: Failed to generate review',
    };
  }

  async generateFileReview(_params: FileReviewParams): Promise<AIReviewResult> {
    return {
      success: false,
      content: '',
      error: 'Mock error: Failed to generate file review',
    };
  }

  async sortFiles(params: SortFilesParams): Promise<FileChangeStats[]> {
    // Return unsorted files (simulates backend failure)
    return params.files;
  }

  async testTool(_params: TestToolParams): Promise<boolean> {
    return false;
  }

  async getAvailableTools(): Promise<AITool[]> {
    return [];
  }
}
