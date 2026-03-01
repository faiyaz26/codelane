import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';

/**
 * Detector for OpenCode CLI.
 */
export class OpenCodeDetector extends BaseDetector {
  readonly agentType = 'opencode' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [
      /❯\s*$/,
      /\?\s*$/,
      /Please enter/i,
      /Confirm/i,
      /Are you sure/i,
    ],
    errorPatterns: [/error:/i, /failed/i],
    // OpenCode uses charmbracelet/bubbles spinners (Braille Dot or MiniDot)
    workingPatterns: [/[⣾⣽⣻⢿⡿⣟⣯⣷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/],
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
