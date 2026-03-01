/**
 * Agent type definitions for CLI agents
 */

export type AgentType = 'claude' | 'cursor' | 'aider' | 'opencode' | 'codex' | 'gemini' | 'shell';

/**
 * Configuration for a CLI agent
 */
export interface AgentConfig {
  name?: string; // Optional display name
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
  installedAgents: AgentConfig[];
}

/**
 * Default shell configuration
 */
export const defaultShellAgent: AgentConfig = {
  name: 'Shell',
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
  name: 'Claude Code',
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
  name: 'Cursor',
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
  name: 'Aider',
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
  name: 'OpenCode',
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
  name: 'Codex',
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
  name: 'Gemini',
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
  installedAgents: [
    defaultShellAgent,
    claudePreset,
    geminiPreset,
    aiderPreset,
  ],
};

/**
 * Get default agent settings (function wrapper for consistency)
 */
export function getDefaultAgentSettings(): AgentSettings {
  return defaultAgentSettings;
}
