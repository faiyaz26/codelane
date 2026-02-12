import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for OpenAI Codex CLI.
 */
export class CodexDetector extends BaseDetector {
  readonly agentType = 'codex' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [],
    errorPatterns: [/error:/i, /failed/i],
    idleTimeoutMs: 3000,
  };
}
