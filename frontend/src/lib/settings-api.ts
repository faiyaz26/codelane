/**
 * Settings API - Tauri command wrappers for agent settings
 */

import { invoke } from '@tauri-apps/api/core';
import type { AgentConfig, AgentSettings } from '../types/agent';

/**
 * Get current agent settings
 */
export async function getAgentSettings(): Promise<AgentSettings> {
  return await invoke<AgentSettings>('settings_get_agents');
}

/**
 * Update agent settings
 */
export async function updateAgentSettings(settings: AgentSettings): Promise<void> {
  await invoke('settings_update_agents', { settings });
}

/**
 * Get resolved agent config for a specific lane
 * Resolution: lane override -> global default
 */
export async function getLaneAgentConfig(laneId: string): Promise<AgentConfig> {
  return await invoke<AgentConfig>('lane_get_agent_config', { laneId });
}

/**
 * Update agent configuration for a specific lane
 * Pass null to use global default
 */
export async function updateLaneAgentConfig(
  laneId: string,
  agentConfig: AgentConfig | null
): Promise<void> {
  await invoke('lane_update_agent_config', { laneId, agentConfig });
}
