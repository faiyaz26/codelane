import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeDetector } from '../ClaudeDetector';

describe('ClaudeDetector', () => {
  let detector: ClaudeDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new ClaudeDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('has correct agent type', () => {
    expect(detector.agentType).toBe('claude');
  });

  it('transitions to working during streaming output', () => {
    detector.feedChunk('Generating code for your request...');
    expect(detector.getStatus()).toBe('working');
  });

  it('transitions to done after 4s idle (output stopped)', () => {
    detector.feedChunk('streaming output');

    // At 3.9s, still working
    vi.advanceTimersByTime(3900);
    expect(detector.getStatus()).toBe('working');

    // At 4.1s, transitions to done
    vi.advanceTimersByTime(200);
    expect(detector.getStatus()).toBe('done');
  });

  it('transitions from done to idle after 5 minutes', () => {
    detector.feedChunk('output');
    vi.advanceTimersByTime(4100); // → done
    expect(detector.getStatus()).toBe('done');

    vi.advanceTimersByTime(5 * 60 * 1000); // → idle
    expect(detector.getStatus()).toBe('idle');
  });

  it('detects error: pattern', () => {
    detector.feedChunk('error: connection refused');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects RATE_LIMIT', () => {
    detector.feedChunk('RATE_LIMIT: too many requests');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects APIError', () => {
    detector.feedChunk('APIError: invalid key');
    expect(detector.getStatus()).toBe('error');
  });

  it('does not false-positive on normal text containing "error" substring', () => {
    detector.feedChunk('Found 0 errors in compilation');
    // This doesn't contain "error:" with colon, so should be working
    expect(detector.getStatus()).toBe('working');
  });

  it('stays done on short keystroke echoes (user typing)', () => {
    detector.feedChunk('agent output');
    vi.advanceTimersByTime(4100); // → done
    expect(detector.getStatus()).toBe('done');

    // User types a few characters — echoed as short PTY output
    detector.feedChunk('h');
    detector.feedChunk('e');
    detector.feedChunk('l');
    expect(detector.getStatus()).toBe('done');
  });

  it('transitions to working on sustained agent output after done', () => {
    detector.feedChunk('agent output');
    vi.advanceTimersByTime(4100); // → done
    expect(detector.getStatus()).toBe('done');

    // Agent starts responding — large chunk
    detector.feedChunk('Here is the code I generated for you...');
    expect(detector.getStatus()).toBe('working');
  });

  // Permission / question prompts → waiting_for_input
  it('detects "Do you want to proceed?" as waiting_for_input', () => {
    detector.feedChunk('Do you want to proceed? (y/n)');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "Do you want me to" as waiting_for_input', () => {
    detector.feedChunk('Do you want me to edit this file?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "Should I" as waiting_for_input', () => {
    detector.feedChunk('Should I continue with the changes?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "Would you like" as waiting_for_input', () => {
    detector.feedChunk('Would you like me to run the tests?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects (y)es/(n)o prompt as waiting_for_input', () => {
    detector.feedChunk('Apply changes? (y)es/(n)o');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects [Y/n] prompt as waiting_for_input', () => {
    detector.feedChunk('Continue? [Y/n]');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
});
