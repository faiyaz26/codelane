import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodexDetector } from '../CodexDetector';

describe('CodexDetector', () => {
  let detector: CodexDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new CodexDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('has correct agent type', () => {
    expect(detector.agentType).toBe('codex');
  });

  it('transitions to working during normal output', () => {
    detector.feedChunk('Working on request...');
    expect(detector.getStatus()).toBe('working');
  });

  it('transitions to done after 3s idle timeout', () => {
    detector.feedChunk('output');
    vi.advanceTimersByTime(2900);
    expect(detector.getStatus()).toBe('working');

    vi.advanceTimersByTime(200);
    expect(detector.getStatus()).toBe('done');
  });

  it('detects error pattern', () => {
    detector.feedChunk('Error: invalid request');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects failed pattern', () => {
    detector.feedChunk('Action failed');
    expect(detector.getStatus()).toBe('error');
  });

  it('transitions to waiting_for_input on window title change', () => {
    detector.feedWindowTitle('Codex - Ready');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('transitions to working on window title change', () => {
    detector.feedWindowTitle('Codex - Working');
    expect(detector.getStatus()).toBe('working');
  });

  it('detects confirmation prompt as waiting_for_input', () => {
    detector.feedChunk('Are you sure you want to proceed?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
  
  it('detects prompt as waiting_for_input', () => {
    detector.feedChunk('❯ ');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
});
