import type { AgentDetector, DetectorPatterns } from './types';
import type { AgentStatus } from '../../types/agentStatus';

/** Strip ANSI escape sequences so pattern matching works on plain text */
// Matches: CSI sequences (\x1b[...X), OSC sequences (\x1b]...ST), and simple escapes
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b[()][0-2AB]|\x1b[>=<]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

/** How long (ms) the status stays 'done' before reverting to 'idle' */
const DONE_TO_IDLE_MS = 5 * 60 * 1000; // 5 minutes

/** Default byte threshold for done → working transition */
const DEFAULT_DONE_TO_WORKING_BYTES = 200;

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
 *   waiting_for_input → working (user provided input via feedUserInput)
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

    // Strip ANSI escape sequences for pattern matching (TUI agents like Claude/Gemini emit styled output)
    const plain = stripAnsi(text);

    // Check for waiting patterns (agent specifically needs user attention)
    const matchedWaiting = this.findMatchingWaitingPattern(plain);
    if (matchedWaiting) {
      this.clearDoneToWorkingTimer();
      this.transitionTo('waiting_for_input', `waiting pattern matched: ${matchedWaiting}`);
      return;
    }

    // Check for error patterns
    const matchedError = this.findMatchingErrorPattern(plain);
    if (matchedError) {
      this.clearDoneToWorkingTimer();
      this.transitionTo('error', `error pattern matched: ${matchedError}`);
      return;
    }

    // waiting_for_input is fully sticky — ignore all PTY output.
    // Only feedUserInput() can transition out of this state.
    if (this.status === 'waiting_for_input') {
      return;
    }

    // When in 'done' state, debounce the transition to 'working'.
    // Avoids flicker from echoed user keystrokes — only transition
    // when sustained output indicates the agent is actually working again.
    if (this.status === 'done') {
      const threshold = this.patterns.doneToWorkingBytes ?? DEFAULT_DONE_TO_WORKING_BYTES;
      this.pendingOutputBytes += text.length;

      // If accumulated output exceeds threshold, transition immediately
      if (this.pendingOutputBytes >= threshold) {
        const bytes = this.pendingOutputBytes;
        this.clearDoneToWorkingTimer();
        this.clearDoneTimer();
        this.transitionTo('working', `sustained output after done (${bytes} bytes >= ${threshold} threshold)`);
      } else if (!this.doneToWorkingTimer) {
        // Start debounce timer
        this.doneToWorkingTimer = setTimeout(() => {
          this.doneToWorkingTimer = null;
          // After debounce, check if enough output accumulated
          if (this.pendingOutputBytes >= threshold) {
            const bytes = this.pendingOutputBytes;
            this.clearDoneTimer();
            this.pendingOutputBytes = 0;
            this.transitionTo('working', `sustained output after debounce from done (${bytes} bytes >= ${threshold} threshold)`);
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
      this.transitionTo('working', `output received (${text.length} bytes)`);
    }

    // Start idle timer — when output stops, infer 'done'
    this.startIdleTimer();
  }

  feedUserInput(_text: string): void {
    // User typed into the terminal — if we're waiting for input, transition to working
    if (this.status === 'waiting_for_input') {
      this.transitionTo('working', 'user provided input');
    }
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

  protected transitionTo(newStatus: AgentStatus, reason?: string): void {
    if (this.status !== newStatus) {
      const prev = this.status;
      this.status = newStatus;
      if (import.meta.env.DEV) {
        console.log(
          `[AgentStatus] ${this.agentType}: ${prev} → ${newStatus}${reason ? ` | ${reason}` : ''}`
        );
      }
      this.onStatusChangeCb?.(newStatus);
    }
  }

  protected findMatchingWaitingPattern(text: string): string | null {
    for (const p of this.patterns.waitingPatterns) {
      if (p.test(text)) return p.source;
    }
    return null;
  }

  protected findMatchingErrorPattern(text: string): string | null {
    for (const p of this.patterns.errorPatterns) {
      if (p.test(text)) return p.source;
    }
    return null;
  }

  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.status === 'working') {
        this.transitionTo('done', `idle timeout (${this.patterns.idleTimeoutMs}ms with no output)`);
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
        this.transitionTo('idle', `done timeout expired (${DONE_TO_IDLE_MS / 1000}s)`);
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
