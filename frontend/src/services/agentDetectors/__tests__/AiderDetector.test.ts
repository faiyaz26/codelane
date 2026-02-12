import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiderDetector } from '../AiderDetector';

describe('AiderDetector', () => {
  let detector: AiderDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new AiderDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('has correct agent type', () => {
    expect(detector.agentType).toBe('aider');
  });

  it('detects BEL character (\\x07) as waiting for input', () => {
    detector.feedChunk('some output\x07');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('BEL character takes precedence over other patterns', () => {
    detector.feedChunk('still processing...');
    expect(detector.getStatus()).toBe('working');

    detector.feedChunk('\x07');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects aider> prompt as waiting for input', () => {
    detector.feedChunk('aider> ');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('transitions to working during output', () => {
    detector.feedChunk('Editing files...');
    expect(detector.getStatus()).toBe('working');
  });

  it('transitions to done after 3s idle timeout', () => {
    detector.feedChunk('output');
    vi.advanceTimersByTime(2900);
    expect(detector.getStatus()).toBe('working');

    vi.advanceTimersByTime(200);
    expect(detector.getStatus()).toBe('done');
  });

  it('detects APIError', () => {
    detector.feedChunk('APIError: rate limited');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects api_key error', () => {
    detector.feedChunk('api_key not set');
    expect(detector.getStatus()).toBe('error');
  });

  it('detects error: pattern', () => {
    detector.feedChunk('Error: file not found');
    expect(detector.getStatus()).toBe('error');
  });
});
