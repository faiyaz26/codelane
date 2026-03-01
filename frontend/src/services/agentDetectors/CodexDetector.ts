import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for OpenAI Codex CLI.
 */
export class CodexDetector extends BaseDetector {
  readonly agentType = 'codex' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [
      /❯\s*$/,
      /\?\s*$/,
      /Please enter/i,
      /Confirm/i,
      /Are you sure/i,
      /^\s*>\s*$/m,
    ],
    errorPatterns: [/error:/i, /failed/i],
    // Codex shows "• Working" text and uses multiple spinner styles (dots, ASCII art, blocks)
    workingPatterns: [/Working/i, /[●○◉·⣾⣽⣻⢿⡿⣟⣯⣷]/],
    idleTimeoutMs: 3000,
  };

  override feedWindowTitle(title: string): void {
    const lowerTitle = title.trim().toLowerCase();
    
    if (lowerTitle.includes('working') || lowerTitle.includes('running')) {
      this.transitionTo('working', `window title changed: ${title}`);
    } else if (lowerTitle.includes('ready') || lowerTitle.includes('waiting') || lowerTitle.includes('prompt')) {
      this.transitionTo('waiting_for_input', `window title changed: ${title}`);
    }
  }
}
