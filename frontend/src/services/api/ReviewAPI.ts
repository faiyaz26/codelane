/**
 * Review API Interface and Implementation
 *
 * Abstraction layer for AI code review operations.
 * Decouples business logic from Tauri invoke calls.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ReviewGenerationParams,
  FileReviewParams,
  SortFilesParams,
  TestToolParams,
  AIReviewResult,
  FileChangeStats,
} from './types';
import type { AITool } from '../AIReviewService';
import { ReviewAPIError } from './ReviewAPIError';

/**
 * Review API interface
 *
 * Defines all operations for AI code review functionality.
 * Implement this interface to create mock or alternative implementations.
 */
export interface IReviewAPI {
  /**
   * Generate an AI review for code changes
   */
  generateReview(params: ReviewGenerationParams): Promise<AIReviewResult>;

  /**
   * Generate an AI review for a specific file
   */
  generateFileReview(params: FileReviewParams): Promise<AIReviewResult>;

  /**
   * Sort files by importance/dependency order
   */
  sortFiles(params: SortFilesParams): Promise<FileChangeStats[]>;

  /**
   * Test if an AI tool is available
   */
  testTool(params: TestToolParams): Promise<boolean>;

  /**
   * Get list of available AI tools
   */
  getAvailableTools(): Promise<AITool[]>;
}

/**
 * Review API implementation using Tauri invoke
 *
 * This is the production implementation that calls Rust backend commands.
 */
export class ReviewAPI implements IReviewAPI {
  async generateReview(params: ReviewGenerationParams): Promise<AIReviewResult> {
    // Check if already aborted
    if (params.signal?.aborted) {
      throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
    }

    try {
      // TODO: Pass signal to Tauri invoke if supported
      // For now, we check before/after the call
      const result = await invoke<AIReviewResult>('ai_generate_review', {
        tool: params.tool,
        diffContent: params.diffContent,
        prompt: params.prompt,
        workingDir: params.workingDir,
        model: params.model || null,
      });

      // Check if aborted during operation
      if (params.signal?.aborted) {
        throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
      }

      return result;
    } catch (err) {
      if (params.signal?.aborted) {
        throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
      }
      throw ReviewAPIError.from(err, 'Failed to generate review', 'GENERATE_REVIEW_FAILED');
    }
  }

  async generateFileReview(params: FileReviewParams): Promise<AIReviewResult> {
    // Check if already aborted
    if (params.signal?.aborted) {
      throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
    }

    try {
      // The backend command is the same as generateReview,
      // just with different prompt and diff content
      const result = await invoke<AIReviewResult>('ai_generate_review', {
        tool: params.tool,
        diffContent: params.diffContent,
        prompt: params.customPrompt || `Analyze the changes in ${params.filePath}`,
        workingDir: params.workingDir,
        model: params.model || null,
      });

      // Check if aborted during operation
      if (params.signal?.aborted) {
        throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
      }

      return result;
    } catch (err) {
      if (params.signal?.aborted) {
        throw new ReviewAPIError('Operation cancelled', undefined, 'ABORTED');
      }
      throw ReviewAPIError.from(
        err,
        `Failed to generate file review for ${params.filePath}`,
        'GENERATE_FILE_REVIEW_FAILED'
      );
    }
  }

  async sortFiles(params: SortFilesParams): Promise<FileChangeStats[]> {
    try {
      return await invoke<FileChangeStats[]>('git_sort_files', {
        files: params.files,
        sortOrder: params.sortOrder,
        workingDir: params.workingDir,
      });
    } catch (err) {
      throw ReviewAPIError.from(err, 'Failed to sort files', 'SORT_FILES_FAILED');
    }
  }

  async testTool(params: TestToolParams): Promise<boolean> {
    try {
      return await invoke<boolean>('ai_test_tool', {
        tool: params.tool,
      });
    } catch (err) {
      console.error(`Failed to test tool ${params.tool}:`, err);
      return false;
    }
  }

  async getAvailableTools(): Promise<AITool[]> {
    try {
      const tools = await invoke<string[]>('ai_get_available_tools');
      return tools as AITool[];
    } catch (err) {
      console.error('Failed to get available tools:', err);
      return [];
    }
  }
}
