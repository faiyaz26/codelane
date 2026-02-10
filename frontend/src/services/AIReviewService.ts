/**
 * AI Code Review Service
 *
 * Handles interaction with local AI CLI tools for code review generation
 */

import { invoke } from '@tauri-apps/api/core';

export type AITool = 'claude' | 'aider' | 'opencode' | 'gemini';

export interface AIReviewResult {
  success: boolean;
  content: string;
  error?: string;
}

export interface AIReviewRequest {
  tool: AITool;
  diffContent: string;
  workingDir: string;
  customPrompt?: string;
}

export class AIReviewService {
  /**
   * Generate a code review summary
   */
  async generateReview(request: AIReviewRequest): Promise<AIReviewResult> {
    const prompt = request.customPrompt || this.getDefaultPrompt();

    try {
      const result = await invoke<AIReviewResult>('ai_generate_review', {
        tool: request.tool,
        diffContent: request.diffContent,
        prompt,
        workingDir: request.workingDir,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a commit summary
   */
  async generateCommitSummary(
    tool: AITool,
    diffContent: string,
    workingDir: string
  ): Promise<AIReviewResult> {
    const prompt = `Analyze these code changes and generate a concise commit message.

Format:
- First line: Short summary (50 chars max)
- Blank line
- Body: Explain what changed and why (wrap at 72 chars)

Be specific and use imperative mood (e.g., "Add feature" not "Added feature").`;

    return this.generateReview({
      tool,
      diffContent,
      workingDir,
      customPrompt: prompt,
    });
  }

  /**
   * Get code suggestions for a specific file
   */
  async getCodeSuggestions(
    tool: AITool,
    filePath: string,
    diffContent: string,
    workingDir: string
  ): Promise<AIReviewResult> {
    const prompt = `Review the changes in ${filePath} and provide:

1. **Code Quality**: Any style or maintainability concerns
2. **Potential Bugs**: Logic errors or edge cases
3. **Security**: Vulnerabilities or security concerns
4. **Performance**: Optimization opportunities
5. **Suggestions**: Specific improvements

Be concise and actionable.`;

    return this.generateReview({
      tool,
      diffContent,
      workingDir,
      customPrompt: prompt,
    });
  }

  /**
   * Test if an AI tool is available
   */
  async testTool(tool: AITool): Promise<boolean> {
    try {
      return await invoke<boolean>('ai_test_tool', { tool });
    } catch (error) {
      console.error(`Failed to test tool ${tool}:`, error);
      return false;
    }
  }

  /**
   * Get list of available AI tools
   */
  async getAvailableTools(): Promise<AITool[]> {
    try {
      const tools = await invoke<string[]>('ai_get_available_tools');
      return tools as AITool[];
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Get the default review prompt
   */
  private getDefaultPrompt(): string {
    return `You are an expert code reviewer. Analyze these changes and provide a structured review.

## Instructions

1. **Summary**: Brief overview of what changed (2-3 sentences)
2. **Key Changes**: Bullet points of main modifications
3. **Concerns**: Potential issues, bugs, or areas that need attention
4. **Suggestions**: Specific improvements or recommendations
5. **Positive Notes**: What was done well

Be concise, specific, and constructive. Focus on actionable feedback.`;
  }

  /**
   * Format diff content for better AI understanding
   */
  formatDiffForAI(files: Array<{ path: string; diff: string }>): string {
    return files
      .map((file) => {
        return `\`\`\`diff\n# File: ${file.path}\n${file.diff}\n\`\`\``;
      })
      .join('\n\n');
  }
}

// Export singleton instance
export const aiReviewService = new AIReviewService();
