import { describe, it, expect } from 'vitest';
import { createDetector } from '../index';
import { ClaudeDetector } from '../ClaudeDetector';
import { CopilotDetector } from '../CopilotDetector';
import { CodexDetector } from '../CodexDetector';
import { OpenCodeDetector } from '../OpenCodeDetector';
import { GeminiDetector } from '../GeminiDetector';
import { ShellDetector } from '../ShellDetector';

describe('createDetector factory', () => {
  it('creates ClaudeDetector for claude type', () => {
    expect(createDetector('claude')).toBeInstanceOf(ClaudeDetector);
  });

  it('creates CopilotDetector for copilot type', () => {
    expect(createDetector('copilot')).toBeInstanceOf(CopilotDetector);
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

  it('falls back to ShellDetector for unknown types', () => {
    expect(createDetector('unknown_agent' as any)).toBeInstanceOf(ShellDetector);
  });

  it('creates independent instances', () => {
    const d1 = createDetector('claude');
    const d2 = createDetector('claude');
    expect(d1).not.toBe(d2);
  });
});
