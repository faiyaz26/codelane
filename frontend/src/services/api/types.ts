/**
 * API Type Definitions
 *
 * Type definitions for the Review API abstraction layer.
 */

import type { AITool, AIReviewResult } from '../AIReviewService';
import type { FileChangeStats } from '../../types/git';

export interface ReviewGenerationParams {
  tool: AITool;
  diffContent: string;
  prompt: string;
  workingDir: string;
  model?: string | null;
  signal?: AbortSignal;
}

export interface FileReviewParams {
  tool: AITool;
  filePath: string;
  diffContent: string;
  workingDir: string;
  model?: string | null;
  customPrompt?: string;
  signal?: AbortSignal;
}

export interface SortFilesParams {
  files: FileChangeStats[];
  sortOrder: string;
  workingDir: string;
}

export interface TestToolParams {
  tool: AITool;
}

export interface GetAvailableToolsResult {
  tools: AITool[];
}

export type { AIReviewResult, FileChangeStats };
