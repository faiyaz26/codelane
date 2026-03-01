/**
 * Settings API - Store-based agent settings management
 */

import { invoke } from '@tauri-apps/api/core';
import { getStore } from './store';
import type { AgentConfig, AgentSettings, AgentType } from '../types/agent';
import { getDefaultAgentSettings } from '../types/agent';
import { getLane } from './lane-api';
import type { AITool } from '../services/AIReviewService';

const AGENT_SETTINGS_KEY = 'agent_settings';

/**
 * Get current agent settings from store
 */
export async function getAgentSettings(): Promise<AgentSettings> {
  const store = await getStore();
  const settings = await store.get<AgentSettings>(AGENT_SETTINGS_KEY);

  if (!settings) {
    return getDefaultAgentSettings();
  }

  // Migration: ensure installedAgents exists
  if (!settings.installedAgents) {
    settings.installedAgents = [settings.defaultAgent];
  }

  return settings;
}

/**
 * Update agent settings in store
 */
export async function updateAgentSettings(settings: AgentSettings): Promise<void> {
  const store = await getStore();
  await store.set(AGENT_SETTINGS_KEY, settings);
  await store.save();
}

/**
 * Get resolved agent config for a specific lane
 * Resolution: lane override -> global default
 */
export async function getLaneAgentConfig(laneId: string): Promise<AgentConfig> {
  const lane = await getLane(laneId);

  // If lane has override, use it
  if (lane.config?.agentOverride) {
    return lane.config.agentOverride;
  }

  // Otherwise use global default
  const settings = await getAgentSettings();
  return settings.defaultAgent;
}

/**
 * Map AgentType to the AITool used for code review / commit summaries.
 * Agents without a direct mapping fall back to 'claude'.
 */
const AGENT_TO_AI_TOOL: Record<AgentType, AITool> = {
  claude: 'claude',
  aider: 'aider',
  opencode: 'opencode',
  gemini: 'gemini',
  codex: 'claude',
  cursor: 'claude',
  shell: 'claude',
};

/**
 * Get the AITool that matches the user's configured default agent.
 */
export async function getReviewTool(): Promise<AITool> {
  const settings = await getAgentSettings();
  return AGENT_TO_AI_TOOL[settings.defaultAgent.agentType] ?? 'claude';
}

/**
 * Check if a command exists in the system and return its full path
 */
export async function checkCommandExists(command: string): Promise<string | null> {
  try {
    const result = await invoke<string | null>('check_command_exists', { command });
    return result;
  } catch (error) {
    console.error('Failed to check command:', error);
    return null;
  }
}
