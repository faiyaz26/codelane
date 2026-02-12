import type { AgentDetector, DetectorPatterns } from './types';
import type { AgentStatus } from '../../types/agentStatus';

/** How long (ms) the status stays 'done' before reverting to 'idle' */
const DONE_TO_IDLE_MS = 5 * 60 * 1000; // 5 minutes

/** Debounce for done → working: output must exceed this byte count to transition */
const DONE_TO_WORKING_BYTES = 20;

/** Debounce window (ms) for accumulating output before deciding done → working */
const DONE_TO_WORKING_DEBOUNCE_MS = 300;

/**
 * Base detector implementing a state machine:
 *
 *   idle → working (output received)
 *   working → done (idle timeout — output stopped)
 *   working → waiting_for_input (waiting pattern matched)
 *   working → error (error pattern matched)
 *   done → idle (after 5 minutes)
 *   done → working (sustained output, not just keystroke echoes)
 */
export abstract class BaseDetector implements AgentDetector {
  abstract readonly agentType: string;
  protected abstract readonly patterns: DetectorPatterns;

  private status: AgentStatus = 'idle';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private doneTimer: ReturnType<typeof setTimeout> | null = null;
  private doneToWorkingTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOutputBytes = 0;
  private onStatusChangeCb: ((status: AgentStatus) => void) | null = null;

  setOnStatusChange(cb: (status: AgentStatus) => void): void {
    this.onStatusChangeCb = cb;
  }

  feedChunk(text: string): void {
    // Reset idle timer on any output
    this.clearIdleTimer();

    // Check for waiting patterns (agent specifically needs user attention)
    if (this.checkWaitingPatterns(text)) {
      this.clearDoneToWorkingTimer();
      this.transitionTo('waiting_for_input');
      return;
    }

    // Check for error patterns
    if (this.checkErrorPatterns(text)) {
      this.clearDoneToWorkingTimer();
      this.transitionTo('error');
      return;
    }

    // When in 'done' state, debounce the transition to 'working'
    // to avoid flicker from echoed user keystrokes
    if (this.status === 'done') {
      this.pendingOutputBytes += text.length;

      // If accumulated output exceeds threshold, transition immediately
      if (this.pendingOutputBytes >= DONE_TO_WORKING_BYTES) {
        this.clearDoneToWorkingTimer();
        this.clearDoneTimer();
        this.pendingOutputBytes = 0;
        this.transitionTo('working');
      } else if (!this.doneToWorkingTimer) {
        // Start debounce timer
        this.doneToWorkingTimer = setTimeout(() => {
          this.doneToWorkingTimer = null;
          // After debounce, check if enough output accumulated
          if (this.pendingOutputBytes >= DONE_TO_WORKING_BYTES) {
            this.clearDoneTimer();
            this.pendingOutputBytes = 0;
            this.transitionTo('working');
          }
          this.pendingOutputBytes = 0;
        }, DONE_TO_WORKING_DEBOUNCE_MS);
      }

      // Start idle timer even in done state
      this.startIdleTimer();
      return;
    }

    // Agent is producing output → working
    if (this.status !== 'working') {
      this.transitionTo('working');
    }

    // Start idle timer — when output stops, infer 'done'
    this.startIdleTimer();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  reset(): void {
    this.status = 'idle';
    this.clearIdleTimer();
    this.clearDoneTimer();
    this.clearDoneToWorkingTimer();
    this.pendingOutputBytes = 0;
  }

  dispose(): void {
    this.clearIdleTimer();
    this.clearDoneTimer();
    this.clearDoneToWorkingTimer();
    this.pendingOutputBytes = 0;
    this.onStatusChangeCb = null;
  }

  protected transitionTo(newStatus: AgentStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChangeCb?.(newStatus);
    }
  }

  protected checkWaitingPatterns(text: string): boolean {
    return this.patterns.waitingPatterns.some(p => p.test(text));
  }

  protected checkErrorPatterns(text: string): boolean {
    return this.patterns.errorPatterns.some(p => p.test(text));
  }

  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.status === 'working') {
        this.transitionTo('done');
        this.startDoneTimer();
      }
    }, this.patterns.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private startDoneTimer(): void {
    this.clearDoneTimer();
    this.doneTimer = setTimeout(() => {
      if (this.status === 'done') {
        this.transitionTo('idle');
      }
    }, DONE_TO_IDLE_MS);
  }

  private clearDoneTimer(): void {
    if (this.doneTimer !== null) {
      clearTimeout(this.doneTimer);
      this.doneTimer = null;
    }
  }

  private clearDoneToWorkingTimer(): void {
    if (this.doneToWorkingTimer !== null) {
      clearTimeout(this.doneToWorkingTimer);
      this.doneToWorkingTimer = null;
    }
    this.pendingOutputBytes = 0;
  }
}
