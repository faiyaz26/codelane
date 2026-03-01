import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenCodeDetector } from '../OpenCodeDetector';

describe('OpenCodeDetector', () => {
  let detector: OpenCodeDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new OpenCodeDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('has correct agent type', () => {
    expect(detector.agentType).toBe('opencode');
  });

  it('transitions to working during normal output', () => {
    detector.feedChunk('Generating response...');
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
    detector.feedChunk('Error: model not found');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects failed pattern', () => {
    detector.feedChunk('Request failed');
    expect(detector.getStatus()).toBe('error');
  });

  it('transitions to waiting_for_input on window title change', () => {
    detector.feedWindowTitle('OpenCode - Ready');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('transitions to working on window title change', () => {
    detector.feedWindowTitle('OpenCode - working');
    expect(detector.getStatus()).toBe('working');
  });

  it('detects confirmation prompt as waiting_for_input', () => {
    detector.feedChunk('Are you sure you want to proceed?');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
  
  it('detects question mark prompt as waiting_for_input', () => {
    detector.feedChunk('What should I do ? ');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
});
