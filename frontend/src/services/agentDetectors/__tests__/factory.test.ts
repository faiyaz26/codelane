import { describe, it, expect } from 'vitest';
import { createDetector } from '../index';
import { ClaudeDetector } from '../ClaudeDetector';
import { AiderDetector } from '../AiderDetector';
import { CursorDetector } from '../CursorDetector';
import { CodexDetector } from '../CodexDetector';
import { OpenCodeDetector } from '../OpenCodeDetector';
import { GeminiDetector } from '../GeminiDetector';
import { ShellDetector } from '../ShellDetector';
import type { DetectableAgentType } from '../../../types/agentStatus';

describe('createDetector factory', () => {
  it('creates ClaudeDetector for claude type', () => {
    expect(createDetector('claude')).toBeInstanceOf(ClaudeDetector);
  });

  it('creates AiderDetector for aider type', () => {
    expect(createDetector('aider')).toBeInstanceOf(AiderDetector);
  });

  it('creates CursorDetector for cursor type', () => {
    expect(createDetector('cursor')).toBeInstanceOf(CursorDetector);
  });

  it('creates CodexDetector for codex type', () => {
    expect(createDetector('codex')).toBeInstanceOf(CodexDetector);
  });

  it('creates OpenCodeDetector for opencode type', () => {
    expect(createDetector('opencode')).toBeInstanceOf(OpenCodeDetector);
  });

  it('creates GeminiDetector for gemini type', () => {
    expect(createDetector('gemini')).toBeInstanceOf(GeminiDetector);
  });

  it('creates ShellDetector for shell type', () => {
    expect(createDetector('shell')).toBeInstanceOf(ShellDetector);
  });

  it('falls back to ShellDetector for unknown type', () => {
    const detector = createDetector('unknown' as DetectableAgentType);
    expect(detector).toBeInstanceOf(ShellDetector);
  });

  it('creates independent instances', () => {
    const d1 = createDetector('claude');
    const d2 = createDetector('claude');
    expect(d1).not.toBe(d2);
  });
});
