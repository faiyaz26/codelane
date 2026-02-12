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
    // Cursor likely uses similar spinner patterns (need to verify with actual usage)
    workingPatterns: [/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/],
    idleTimeoutMs: 3000,
  };
}
