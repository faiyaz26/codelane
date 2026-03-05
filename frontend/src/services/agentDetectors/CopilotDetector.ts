import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for GitHub Copilot CLI.
 */
export class CopilotDetector extends BaseDetector {
  readonly agentType = 'copilot' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [/\? /i, /> /i],
    errorPatterns: [/error:/i, /failed/i],
    workingPatterns: [/(thinking|generating|querying).*\.\.\./i, /working/i],
  };
}
