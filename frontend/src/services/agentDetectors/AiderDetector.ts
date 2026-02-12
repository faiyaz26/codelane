import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for Aider.
 * Aider emits a BEL character (\x07) when waiting for input.
 */
export class AiderDetector extends BaseDetector {
  readonly agentType = 'aider' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [/aider>\s*$/i],
    errorPatterns: [/error:/i, /APIError/i, /api_key/i],
    idleTimeoutMs: 3000,
  };

  override feedChunk(text: string): void {
    // BEL character is Aider's explicit "I need input" signal
    if (text.includes('\x07')) {
      this.transitionTo('waiting_for_input');
      return;
    }
    super.feedChunk(text);
  }
}
