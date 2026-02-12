import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeDetector } from '../ClaudeDetector';
import type { AgentStatus } from '../../../types/agentStatus';

// We test BaseDetector behavior through ClaudeDetector (a concrete subclass)

describe('BaseDetector', () => {
  let detector: ClaudeDetector;
  let statusChanges: AgentStatus[];

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new ClaudeDetector();
    statusChanges = [];
    detector.setOnStatusChange((status) => statusChanges.push(status));
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    expect(detector.getStatus()).toBe('idle');
  });

  it('transitions to working on output', () => {
    detector.feedChunk('some output text');
    expect(detector.getStatus()).toBe('working');
    expect(statusChanges).toEqual(['working']);
  });

  it('does not fire duplicate transitions for same status', () => {
    detector.feedChunk('output 1');
    detector.feedChunk('output 2');
    detector.feedChunk('output 3');

    expect(detector.getStatus()).toBe('working');
    // Only one 'working' transition should have fired
    expect(statusChanges).toEqual(['working']);
  });

  it('transitions to done after idle timeout', () => {
    detector.feedChunk('some output');
    expect(detector.getStatus()).toBe('working');

    // Advance past the idle timeout (4000ms for Claude)
    vi.advanceTimersByTime(4100);

    expect(detector.getStatus()).toBe('done');
    expect(statusChanges).toEqual(['working', 'done']);
  });

  it('resets idle timer on new output', () => {
    detector.feedChunk('output 1');

    // Advance 3 seconds (not past the 4s timeout)
    vi.advanceTimersByTime(3000);
    expect(detector.getStatus()).toBe('working');

    // New output resets the timer
    detector.feedChunk('output 2');

    // Advance another 3 seconds (6s total, but only 3s since last output)
    vi.advanceTimersByTime(3000);
    expect(detector.getStatus()).toBe('working');

    // Now advance past the timeout
    vi.advanceTimersByTime(1100);
    expect(detector.getStatus()).toBe('done');
  });

  it('transitions to error on error pattern match', () => {
    detector.feedChunk('Error: something went wrong');
    expect(detector.getStatus()).toBe('error');
    expect(statusChanges).toEqual(['error']);
  });

  it('detects RATE_LIMIT error', () => {
    detector.feedChunk('RATE_LIMIT exceeded');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects APIError', () => {
    detector.feedChunk('APIError: unauthorized');
    expect(detector.getStatus()).toBe('error');
  });

  it('error patterns take priority over working state', () => {
    detector.feedChunk('working...');
    expect(detector.getStatus()).toBe('working');

    detector.feedChunk('Error: fatal crash');
    expect(detector.getStatus()).toBe('error');
  });

  it('reset returns to idle', () => {
    detector.feedChunk('some output');
    expect(detector.getStatus()).toBe('working');

    detector.reset();
    expect(detector.getStatus()).toBe('idle');
  });

  it('reset clears idle timer', () => {
    detector.feedChunk('some output');
    detector.reset();

    // Advance time - should not transition since we reset
    vi.advanceTimersByTime(5000);
    expect(detector.getStatus()).toBe('idle');
  });

  it('dispose clears callback and timer', () => {
    detector.feedChunk('output');
    detector.dispose();

    // Feed more data - status changes but callback should not fire
    const changesBefore = statusChanges.length;
    detector.feedChunk('Error: crash');
    // Callback was nullified, so no new changes recorded
    expect(statusChanges.length).toBe(changesBefore);
  });

  it('calls onStatusChange callback on each transition', () => {
    const cb = vi.fn();
    detector.setOnStatusChange(cb);

    detector.feedChunk('working...');
    expect(cb).toHaveBeenCalledWith('working');

    detector.feedChunk('Error: crash');
    expect(cb).toHaveBeenCalledWith('error');

    expect(cb).toHaveBeenCalledTimes(2);
  });

  // done → idle after 5 minutes
  it('transitions from done to idle after 5 minutes', () => {
    detector.feedChunk('some output');
    expect(detector.getStatus()).toBe('working');

    // Idle timeout → done
    vi.advanceTimersByTime(4100);
    expect(detector.getStatus()).toBe('done');

    // 5 minutes later → idle
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(detector.getStatus()).toBe('idle');
    expect(statusChanges).toEqual(['working', 'done', 'idle']);
  });

  // done → working debounce: short echoes don't trigger working
  it('stays in done state on short keystroke echoes', () => {
    // Get to done state
    detector.feedChunk('some output');
    vi.advanceTimersByTime(4100);
    expect(detector.getStatus()).toBe('done');

    // Short echo (< 20 bytes) should NOT transition to working
    detector.feedChunk('a');
    expect(detector.getStatus()).toBe('done');

    // Even after debounce window
    vi.advanceTimersByTime(400);
    expect(detector.getStatus()).toBe('done');
  });

  // done → working: sustained output transitions to working
  it('transitions from done to working on sustained output', () => {
    // Get to done state
    detector.feedChunk('some output');
    vi.advanceTimersByTime(4100);
    expect(detector.getStatus()).toBe('done');

    // Large chunk (>= 20 bytes) should transition immediately
    detector.feedChunk('This is a long output from the agent that exceeds threshold');
    expect(detector.getStatus()).toBe('working');
  });
});
