import type { AgentStatus } from '../../types/agentStatus';

/**
 * Interface that every agent detector must implement.
 * Detectors are stateful - they accumulate output and maintain
 * an internal state machine.
 */
export interface AgentDetector {
  /** Unique agent type identifier */
  readonly agentType: string;

  /** Feed a chunk of decoded text output (PTY → terminal) to the detector */
  feedChunk(text: string): void;

  /** Signal that the user typed input into the terminal */
  feedUserInput(text: string): void;

  /** Get the current detected status */
  getStatus(): AgentStatus;

  /** Set callback for status changes */
  setOnStatusChange(cb: (status: AgentStatus) => void): void;

  /** Reset the detector state */
  reset(): void;

  /** Dispose any timers or resources */
  dispose(): void;
}

/**
 * Configuration for pattern-based detection
 */
export interface DetectorPatterns {
  /** Patterns that indicate the agent needs user attention (e.g. permission prompts, questions) */
  waitingPatterns: RegExp[];
  /** Patterns that indicate the agent encountered an error */
  errorPatterns: RegExp[];
  /** Idle timeout in ms — when output stops for this long after 'working', transitions to 'done' */
  idleTimeoutMs: number;
  /** Byte threshold to transition from 'done' → 'working'. Must exceed this to avoid keystroke echo flicker. Default: 200 */
  doneToWorkingBytes?: number;
}
