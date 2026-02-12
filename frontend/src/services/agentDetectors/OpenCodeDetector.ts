import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for OpenCode CLI.
 */
export class OpenCodeDetector extends BaseDetector {
  readonly agentType = 'opencode' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [],
    errorPatterns: [/error:/i, /failed/i],
    // OpenCode uses charmbracelet/bubbles spinners (Braille Dot or MiniDot)
    workingPatterns: [/[⣾⣽⣻⢿⡿⣟⣯⣷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/],
    idleTimeoutMs: 3000,
  };
}
