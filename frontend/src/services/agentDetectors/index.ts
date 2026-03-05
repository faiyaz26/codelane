import type { DetectableAgentType } from '../../types/agentStatus';
import type { AgentDetector } from './types';
import { ClaudeDetector } from './ClaudeDetector';
import { CopilotDetector } from './CopilotDetector';
import { CodexDetector } from './CodexDetector';
import { OpenCodeDetector } from './OpenCodeDetector';
import { GeminiDetector } from './GeminiDetector';
import { ShellDetector } from './ShellDetector';

type DetectorConstructor = new () => AgentDetector;

const registry: Record<string, DetectorConstructor> = {
  claude: ClaudeDetector,
  copilot: CopilotDetector,
  codex: CodexDetector,
  opencode: OpenCodeDetector,
  gemini: GeminiDetector,
  shell: ShellDetector,
};

/** Create an agent detector for the given agent type. Falls back to ShellDetector. */
export function createDetector(agentType: string): AgentDetector {
  const Ctor = registry[agentType] ?? ShellDetector;
  return new Ctor();
}

export { ClaudeDetector } from './ClaudeDetector';
export { CopilotDetector } from './CopilotDetector';
export { CodexDetector } from './CodexDetector';
export { OpenCodeDetector } from './OpenCodeDetector';
export { GeminiDetector } from './GeminiDetector';
export { ShellDetector } from './ShellDetector';
export type { AgentDetector, DetectorPatterns } from './types';
