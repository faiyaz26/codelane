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

    // Agent starts responding — large chunk (>= 200 bytes default)
    detector.feedChunk('Here is the code I generated for you. Let me walk you through the changes I made to each of the files in your project. First, I updated the main configuration file to include the new settings, then I modified the component to handle the new props correctly...');
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

  // ANSI-wrapped prompts (realistic TUI output from Claude Code's Ink renderer)
  it('detects "Do you want to proceed?" wrapped in ANSI escape sequences', () => {
    // Simulates Ink TUI output with color codes
    detector.feedChunk('\x1b[1m\x1b[36mDo you want to proceed?\x1b[39m\x1b[22m\r\n \x1b[36m❯\x1b[39m 1. Yes\r\n   2. No');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "Would you like" with cursor positioning and color escapes', () => {
    detector.feedChunk('\x1b[2K\x1b[1G\x1b[33mWould you like\x1b[39m me to apply these changes?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "(y)es/(n)o" prompt with ANSI styling', () => {
    detector.feedChunk('\x1b[0m\x1b[1mApply changes?\x1b[22m \x1b[2m(y)es/(n)o\x1b[22m');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects "Should I" with mixed ANSI sequences', () => {
    detector.feedChunk('\x1b[2J\x1b[H\x1b[1mShould I \x1b[36mcontinue\x1b[39m with the refactor?\x1b[0m');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects error pattern wrapped in ANSI escape sequences', () => {
    detector.feedChunk('\x1b[31merror:\x1b[39m connection timed out');
    expect(detector.getStatus()).toBe('error');
  });

  // waiting_for_input stays sticky during TUI redraws
  it('stays waiting_for_input when TUI redraws menu (small output)', () => {
    detector.feedChunk('Do you want to proceed? (y/n)');
    expect(detector.getStatus()).toBe('waiting_for_input');

    // TUI renders menu options, cursor animations — small output chunks
    detector.feedChunk('\x1b[36m❯\x1b[39m 1. Yes');
    detector.feedChunk('\x1b[2K\x1b[1G  2. No');
    expect(detector.getStatus()).toBe('waiting_for_input');

    // Even after debounce window
    vi.advanceTimersByTime(400);
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('stays waiting_for_input even on large PTY output (fully sticky)', () => {
    detector.feedChunk('Do you want to proceed? (y/n)');
    expect(detector.getStatus()).toBe('waiting_for_input');

    // Large PTY output (TUI redraws, menus, etc.) should NOT transition to working
    detector.feedChunk('Great, I will now apply the changes to the following files in your project. Let me start with the main configuration file and then move on to the component updates. Here is what I am changing in each file and why these changes are necessary...');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('transitions from waiting_for_input to working when user provides input', () => {
    detector.feedChunk('Do you want to proceed? (y/n)');
    expect(detector.getStatus()).toBe('waiting_for_input');

    // User types into the terminal
    detector.feedUserInput('y');
    expect(detector.getStatus()).toBe('working');
  });
});
