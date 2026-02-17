/**
 * AI Code Changes Summary Service
 *
 * Handles interaction with local AI CLI tools for code changes summary and feedback generation
 */

import { reviewAPI } from './api/provider';
import type { ReviewGenerationParams, FileReviewParams } from './api/types';

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
  model?: string;
  signal?: AbortSignal;
}

// Model options for each tool
export const AI_MODELS: Record<AITool, Array<{ value: string; label: string; description: string }>> = {
  claude: [
    { value: 'haiku', label: 'Claude 3.5 Haiku', description: 'Fast and cost-effective (Recommended)' },
    { value: 'sonnet', label: 'Claude 3.5 Sonnet', description: 'Balanced performance' },
    { value: 'opus', label: 'Claude 3 Opus', description: 'Most capable' },
  ],
  aider: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast and affordable (Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable OpenAI model' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest' },
  ],
  opencode: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Free via GitHub Copilot (Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'More capable' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', description: 'Fast and efficient (Recommended)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Faster' },
  ],
};

export class AIReviewService {
  /**
   * Generate a code changes summary with feedback
   */
  async generateReview(request: AIReviewRequest): Promise<AIReviewResult> {
    const prompt = request.customPrompt || this.getDefaultPrompt();

    try {
      const params: ReviewGenerationParams = {
        tool: request.tool,
        diffContent: request.diffContent,
        prompt,
        workingDir: request.workingDir,
        model: request.model || null,
        signal: request.signal,
      };

      const result = await reviewAPI.generateReview(params);
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
    workingDir: string,
    model?: string
  ): Promise<AIReviewResult> {
    const prompt = `Generate a commit message for these code changes. Output ONLY the commit message text with no additional commentary, formatting, or markdown code blocks.

Format requirements:
- First line: Short summary in imperative mood (50 chars max)
- Blank line
- Body: Explain what changed and why (wrap at 72 chars)

Example output format:
Add user authentication feature

Implement JWT-based authentication with login and signup endpoints.
Add middleware for protected routes and session management.

Do NOT include any of the following in your response:
- Phrases like "Here's the commit message:"
- Markdown code blocks (\`\`\`)
- Explanatory text before or after the commit message
- Any formatting markers

Output the commit message directly.`;

    const result = await this.generateReview({
      tool,
      diffContent,
      workingDir,
      customPrompt: prompt,
      model,
    });

    // Clean up the response - remove common unwanted patterns
    if (result.success && result.content) {
      let cleaned = result.content;

      // Remove common prefixes
      cleaned = cleaned.replace(/^Here's the commit message:\s*/i, '');
      cleaned = cleaned.replace(/^Commit message:\s*/i, '');
      cleaned = cleaned.replace(/^The commit message is:\s*/i, '');

      // Remove markdown code blocks
      cleaned = cleaned.replace(/^```[a-z]*\n/gm, '');
      cleaned = cleaned.replace(/\n```$/gm, '');
      cleaned = cleaned.replace(/^```\s*/gm, '');
      cleaned = cleaned.replace(/\s*```$/gm, '');

      // Trim whitespace
      cleaned = cleaned.trim();

      result.content = cleaned;
    }

    return result;
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
    const prompt = `Analyze the changes in ${filePath} and provide:

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
      return await reviewAPI.testTool({ tool });
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
      return await reviewAPI.getAvailableTools();
    } catch (error) {
      console.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Get the default review prompt
   */
  getDefaultPrompt(): string {
    return `You are an expert code analyst. Analyze these changes and provide a structured summary with feedback.

## Instructions

1. **Summary**: Brief overview of what changed (2-3 sentences)
2. **Key Changes**: Bullet points of main modifications
3. **Concerns**: Potential issues, bugs, or areas that need attention
4. **Suggestions**: Specific improvements or recommendations
5. **Positive Notes**: What was done well

Be concise, specific, and constructive. Focus on actionable feedback.`;
  }

  /**
   * Get an enhanced review prompt with file-by-file analysis
   */
  getEnhancedReviewPrompt(): string {
    return `You are an expert code analyst performing a thorough code review. Analyze these changes and provide a structured review.

## Output Format (use exact headings)

### Summary
Brief overview of what changed and why (2-3 sentences).

### Key Changes
- Bullet points of the main modifications across all files

### Concerns
- Potential issues, bugs, security vulnerabilities, or areas needing attention
- Include severity (low/medium/high) for each concern

### Suggestions
- Specific, actionable improvements or recommendations
- Reference file paths and line numbers when possible

### Positive Notes
- What was done well, good patterns observed

Be concise, specific, and constructive. Focus on actionable feedback. Use markdown formatting.`;
  }

  /**
   * Get the default per-file review prompt
   */
  getDefaultFilePrompt(): string {
    return `Analyze the changes in this file and provide brief, focused feedback.

Include:
1. What changed and why (1-2 sentences)
2. Any concerns (bugs, security, performance)
3. Specific suggestions for improvement

Be very concise — aim for 3-5 bullet points total. No preamble.`;
  }

  /**
   * Generate focused per-file review feedback
   */
  async generateFileReview(
    tool: AITool,
    filePath: string,
    diffContent: string,
    workingDir: string,
    model?: string,
    customPrompt?: string,
    signal?: AbortSignal
  ): Promise<AIReviewResult> {
    const prompt = customPrompt || `${this.getDefaultFilePrompt()}\n\nFile: ${filePath}`;

    try {
      const params: FileReviewParams = {
        tool,
        filePath,
        diffContent,
        workingDir,
        model: model || null,
        customPrompt: prompt,
        signal,
      };

      return await reviewAPI.generateFileReview(params);
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
