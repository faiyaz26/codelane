import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for Claude Code CLI.
 *
 * State transitions are inferred:
 *   - Output flowing → working
 *   - Output stops (4s idle) → done (Claude finished its turn)
 *   - Permission/question prompts → waiting_for_input
 *   - done stays green for 5 min → idle
 */
export class ClaudeDetector extends BaseDetector {
  readonly agentType = 'claude' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [
      /Do you want to proceed\?/i,
      /\(y\)es\/\(n\)o/i,
      /\[Y\/n\]/i,
      /\[y\/N\]/i,
      /Do you want me to/i,
      /Should I /i,
      /Would you like/i,
    ],
    errorPatterns: [/error:/i, /RATE_LIMIT/i, /APIError/i],
    idleTimeoutMs: 4000,
    doneToWorkingBytes: 50,
  };
}
