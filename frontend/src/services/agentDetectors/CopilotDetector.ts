import { BaseDetector } from './BaseDetector';

/**
 * Detector for GitHub Copilot CLI.
 */
export class CopilotDetector extends BaseDetector {
  readonly agentType = 'copilot' as const;

  constructor() {
    super({
      // Common prompt patterns for copilot cli
      waitingPatterns: [/\? /i, /> /i],
      // Common working patterns
      workingPatterns: [/(thinking|generating|querying).*\.\.\./i, /working/i],
    });
  }
}
