import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiDetector } from '../GeminiDetector';

describe('GeminiDetector', () => {
  let detector: GeminiDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new GeminiDetector();
  });

  afterEach(() => {
    detector.dispose();
    vi.useRealTimers();
  });

  it('has correct agent type', () => {
    expect(detector.agentType).toBe('gemini');
  });

  it('detects [NORMAL] footer', () => {
    detector.feedChunk('some output [NORMAL]');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects [INSERT] footer', () => {
    detector.feedChunk('[INSERT] mode');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects cursor shape escape sequence (blinking block)', () => {
    detector.feedChunk('output\x1b[1 q');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });

  it('detects cursor shape escape sequence (steady block)', () => {
    detector.feedChunk('output\x1b[2 q');
    expect(detector.getStatus()).toBe('waiting_for_input');
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

  it('cursor shape overrides take priority', () => {
    detector.feedChunk('working...');
    expect(detector.getStatus()).toBe('working');

    detector.feedChunk('\x1b[1 q');
    expect(detector.getStatus()).toBe('waiting_for_input');
  });
});
