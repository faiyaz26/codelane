/**
 * Agent type definitions for CLI agents
 */

export type AgentType = 'claude' | 'cursor' | 'aider' | 'opencode' | 'codex' | 'gemini' | 'shell';

/**
 * Configuration for a CLI agent
 */
export interface AgentConfig {
  agentType: AgentType;
  command: string;
  args: string[];
  env: Record<string, string>;
  useLaneCwd: boolean;
}

/**
 * Global agent settings with presets
 */
export interface AgentSettings {
  defaultAgent: AgentConfig;
  presets: Record<string, AgentConfig>;
}

/**
 * Default shell configuration
 */
export const defaultShellAgent: AgentConfig = {
  agentType: 'shell',
  command: '/bin/zsh',
  args: ['-l', '-i'],
  env: {},
  useLaneCwd: true,
};

/**
 * Claude Code preset
 */
export const claudePreset: AgentConfig = {
  agentType: 'claude',
  command: 'claude',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * Cursor preset
 */
export const cursorPreset: AgentConfig = {
  agentType: 'cursor',
  command: 'cursor',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * Aider preset
 */
export const aiderPreset: AgentConfig = {
  agentType: 'aider',
  command: 'aider',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * OpenCode preset
 */
export const openCodePreset: AgentConfig = {
  agentType: 'opencode',
  command: 'opencode',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * Codex preset
 */
export const codexPreset: AgentConfig = {
  agentType: 'codex',
  command: 'codex',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * Gemini preset
 */
export const geminiPreset: AgentConfig = {
  agentType: 'gemini',
  command: 'gemini',
  args: [],
  env: {},
  useLaneCwd: true,
};

/**
 * Default agent settings
 */
export const defaultAgentSettings: AgentSettings = {
  defaultAgent: defaultShellAgent,
  presets: {
    shell: defaultShellAgent,
    claude: claudePreset,
    cursor: cursorPreset,
    aider: aiderPreset,
    opencode: openCodePreset,
    codex: codexPreset,
    gemini: geminiPreset,
  },
};

/**
 * Get default agent settings (function wrapper for consistency)
 */
export function getDefaultAgentSettings(): AgentSettings {
  return defaultAgentSettings;
}
