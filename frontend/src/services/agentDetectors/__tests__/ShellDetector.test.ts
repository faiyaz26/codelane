import { describe, it, expect } from 'vitest';
import { ShellDetector } from '../ShellDetector';

describe('ShellDetector', () => {
  it('has correct agent type', () => {
    const detector = new ShellDetector();
    expect(detector.agentType).toBe('shell');
  });

  it('always returns idle status', () => {
    const detector = new ShellDetector();
    expect(detector.getStatus()).toBe('idle');
  });

  it('remains idle after feedChunk', () => {
    const detector = new ShellDetector();
    detector.feedChunk('some shell output');
    expect(detector.getStatus()).toBe('idle');
  });

  it('remains idle after feedChunk with prompt patterns', () => {
    const detector = new ShellDetector();
    detector.feedChunk('user@host:~$ ');
    expect(detector.getStatus()).toBe('idle');
  });

  it('remains idle after feedChunk with error patterns', () => {
    const detector = new ShellDetector();
    detector.feedChunk('Error: command not found');
    expect(detector.getStatus()).toBe('idle');
  });

  it('reset keeps idle state', () => {
    const detector = new ShellDetector();
    detector.feedChunk('anything');
    detector.reset();
    expect(detector.getStatus()).toBe('idle');
  });
});
