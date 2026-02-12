import { BaseDetector } from './BaseDetector';
import type { DetectorPatterns } from './types';
import type { AgentStatus } from '../../types/agentStatus';

/**
 * No-op detector for plain shell sessions.
 * Always reports idle -- no agent detection is performed.
 */
export class ShellDetector extends BaseDetector {
  readonly agentType = 'shell' as const;

  protected readonly patterns: DetectorPatterns = {
    waitingPatterns: [],
    errorPatterns: [],
    idleTimeoutMs: 0,
  };

  override feedChunk(_text: string): void {
    // No-op: plain shell has no agent to detect
  }

  override getStatus(): AgentStatus {
    return 'idle';
  }
}
