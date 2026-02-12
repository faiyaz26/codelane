import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for Gemini CLI.
 * Gemini uses cursor shape escape sequences and vim-style mode footers.
 */
export class GeminiDetector extends BaseDetector {
  readonly agentType = 'gemini' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [/\[NORMAL\]/],
    errorPatterns: [/error:/i, /failed/i],
    // Gemini uses ink-spinner (Braille patterns) and shows tool execution status symbols
    workingPatterns: [/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⊷]/],
    idleTimeoutMs: 3000,
  };

  override feedChunk(text: string): void {
    // Cursor shape sequences (\x1b[1 q = blinking block, \x1b[2 q = steady block)
    // or [NORMAL]/[INSERT] footer indicate Gemini is waiting for input
    if (/\x1b\[[12] q/.test(text)) {
      this.transitionTo('waiting_for_input', 'cursor shape escape sequence detected');
      return;
    }
    if (/\[(NORMAL|INSERT)\]/.test(text)) {
      this.transitionTo('waiting_for_input', 'vim-style mode footer detected');
      return;
    }
    super.feedChunk(text);
  }
}
