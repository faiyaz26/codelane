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
  private userInputPending = false;
  private lastSpinnerChar: string | null = null;
  private lastSpinnerTime = 0;
  private onStatusChangeCb: ((status: AgentStatus) => void) | null = null;
  private lastBufferSnapshot = '';

  setOnStatusChange(cb: (status: AgentStatus) => void): void {
    this.onStatusChangeCb = cb;
  }

  /**
   * Feed a snapshot of the terminal buffer for periodic checking.
   * This samples the actual terminal screen content to catch prompts
   * that might be missed by streaming chunk detection.
   */
  feedBufferSnapshot(text: string): void {
    // Skip if snapshot is identical to last one (no change)
    if (text === this.lastBufferSnapshot) return;
    this.lastBufferSnapshot = text;

    // Strip ANSI and check for patterns (same logic as feedChunk)
    const plain = stripAnsi(text);

    // Check for waiting patterns (highest priority)
    const matchedWaiting = this.findMatchingWaitingPattern(plain);
    if (matchedWaiting) {
      // Don't clear idle timer - let feedChunk handle that
      this.userInputPending = false;
      this.transitionTo('waiting_for_input', `waiting pattern in buffer: ${matchedWaiting}`);
      return;
    }

    // Check for error patterns
    const matchedError = this.findMatchingErrorPattern(plain);
    if (matchedError) {
      this.userInputPending = false;
      this.transitionTo('error', `error pattern in buffer: ${matchedError}`);
      return;
    }

    // Note: We don't check spinner animation here because buffer snapshots
    // are static - spinner animation requires comparing across frames (feedChunk handles this)
  }

  feedChunk(text: string): void {
    // Strip ANSI escape sequences for pattern matching (TUI agents like Claude/Gemini emit styled output)
    const plain = stripAnsi(text);

    // Reset idle timer on any output
    this.clearIdleTimer();

    // Check for waiting patterns FIRST (highest priority - prompts always take precedence)
    const matchedWaiting = this.findMatchingWaitingPattern(plain);
    if (matchedWaiting) {
      this.clearDoneToWorkingTimer();
      // If user provided input but output still contains a prompt (TUI re-render / new prompt),
      // clear the flag — the agent is still waiting.
      this.userInputPending = false;
      this.transitionTo('waiting_for_input', `waiting pattern matched: ${matchedWaiting}`);
      return;
    }

    // Check for error patterns (second priority)
    const matchedError = this.findMatchingErrorPattern(plain);
    if (matchedError) {
      this.clearDoneToWorkingTimer();
      this.userInputPending = false;
      this.transitionTo('error', `error pattern matched: ${matchedError}`);
      return;
    }

    // Check for spinner animation (third priority - only if not waiting or errored)
    const spinnerChar = this.checkWorkingAnimation(plain);
    if (spinnerChar) {
      // Spinner is animating — agent is actively working
      if (this.status !== 'working') {
        this.transitionTo('working', `spinner animation detected (char: ${spinnerChar})`);
      }
      this.startIdleTimer();
      return;
    }

    // waiting_for_input handling:
    // - If user provided input (flag set) and output has NO waiting pattern,
    //   the agent has started processing → transition to working.
    // - Otherwise, stay sticky in waiting_for_input.
    if (this.status === 'waiting_for_input') {
      if (this.userInputPending) {
        this.userInputPending = false;
        this.transitionTo('working', 'user provided input and agent started processing');
        this.startIdleTimer();
      }
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
    // Set flag so the next feedChunk without a waiting pattern triggers working.
    // We don't transition immediately because TUI agents (Ink) re-render the screen
    // on each frame, and the old prompt text may still appear in the next PTY output.
    if (this.status === 'waiting_for_input') {
      this.userInputPending = true;
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
    this.userInputPending = false;
    this.lastSpinnerChar = null;
    this.lastSpinnerTime = 0;
    this.lastBufferSnapshot = '';
  }

  dispose(): void {
    this.clearIdleTimer();
    this.clearDoneTimer();
    this.clearDoneToWorkingTimer();
    this.pendingOutputBytes = 0;
    this.userInputPending = false;
    this.lastSpinnerChar = null;
    this.lastSpinnerTime = 0;
    this.lastBufferSnapshot = '';
    this.onStatusChangeCb = null;
  }

  protected transitionTo(newStatus: AgentStatus, reason?: string): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
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

  /**
   * Check if output contains working indicators (spinner chars, "Working" text, etc.).
   * Returns the matched spinner character if animation detected, null otherwise.
   */
  protected checkWorkingAnimation(text: string): string | null {
    if (!this.patterns.workingPatterns || this.patterns.workingPatterns.length === 0) {
      return null;
    }

    // Check if any working pattern matches
    for (const p of this.patterns.workingPatterns) {
      const match = text.match(p);
      if (match) {
        // Extract the matched character (spinner char)
        const matchedChar = match[0];
        const now = Date.now();

        // If we saw a different spinner char recently (within 2s), animation is active
        if (
          this.lastSpinnerChar &&
          this.lastSpinnerChar !== matchedChar &&
          now - this.lastSpinnerTime < 2000
        ) {
          this.lastSpinnerChar = matchedChar;
          this.lastSpinnerTime = now;
          return matchedChar; // Animation detected
        }

        // Update tracking
        this.lastSpinnerChar = matchedChar;
        this.lastSpinnerTime = now;
        return null; // Same char or first occurrence — wait for next frame
      }
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
