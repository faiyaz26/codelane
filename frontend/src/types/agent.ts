import type { AITool } from '../services/AIReviewService';

/**
 * Agent type definitions for CLI agents
 */
export type AgentType = 'claude' | 'opencode' | 'codex' | 'gemini' | 'copilot' | 'shell';

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
 * Metadata for each agent type
 */
export interface AgentMetadata {
  label: string;
  aiTool: AITool | 'copilot'; // or whatever aiTool type supports
  supportsHooks: boolean;
  preset: AgentConfig;
}

/**
 * Single source of truth for all supported agents
 */
export const AGENT_METADATA: Record<AgentType, AgentMetadata> = {
  shell: {
    label: 'Shell (Traditional Terminal)',
    aiTool: 'claude',
    supportsHooks: false,
    preset: {
      name: 'Shell',
      agentType: 'shell',
      command: '/bin/zsh',
      args: ['-l', '-i'],
      env: {},
      useLaneCwd: true,
    }
  },
  claude: {
    label: 'Claude Code CLI',
    aiTool: 'claude',
    supportsHooks: true,
    preset: {
      name: 'Claude Code',
      agentType: 'claude',
      command: 'claude',
      args: [],
      env: {},
      useLaneCwd: true,
    }
  },
  gemini: {
    label: 'Gemini CLI',
    aiTool: 'gemini',
    supportsHooks: true,
    preset: {
      name: 'Gemini',
      agentType: 'gemini',
      command: 'gemini',
      args: [],
      env: {},
      useLaneCwd: true,
    }
  },
  opencode: {
    label: 'OpenCode CLI',
    aiTool: 'opencode',
    supportsHooks: true,
    preset: {
      name: 'OpenCode',
      agentType: 'opencode',
      command: 'opencode',
      args: [],
      env: {},
      useLaneCwd: true,
    }
  },
  codex: {
    label: 'OpenAI Codex CLI',
    aiTool: 'claude',
    supportsHooks: true,
    preset: {
      name: 'Codex',
      agentType: 'codex',
      command: 'codex',
      args: [],
      env: {},
      useLaneCwd: true,
    }
  },
  copilot: {
    label: 'GitHub Copilot CLI',
    aiTool: 'copilot',
    supportsHooks: true,
    preset: {
      name: 'GitHub Copilot',
      agentType: 'copilot',
      command: 'copilot',
      args: [],
      env: {},
      useLaneCwd: true,
    }
  },
};

/**
 * Get display label for an agent type
 */
export function getAgentTypeLabel(type: AgentType): string {
  return AGENT_METADATA[type]?.label || type;
}

/**
 * Global agent settings
 */
export interface AgentSettings {
  defaultAgentName: string;
  installedAgents: AgentConfig[];
}

/**
 * Default agent settings
 */
export const defaultAgentSettings: AgentSettings = {
  defaultAgentName: 'Shell',
  installedAgents: [
    AGENT_METADATA.shell.preset,
  ],
};

/**
 * Get default agent settings (function wrapper for consistency)
 */
export function getDefaultAgentSettings(): AgentSettings {
  return defaultAgentSettings;
}

export const defaultShellAgent = AGENT_METADATA.shell.preset;
