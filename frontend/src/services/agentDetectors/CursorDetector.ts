import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for Cursor CLI.
 */
export class CursorDetector extends BaseDetector {
  readonly agentType = 'cursor' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [],
    errorPatterns: [/error:/i, /failed/i],
    idleTimeoutMs: 3000,
  };
}
