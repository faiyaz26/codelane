/**
 * Settings API - Store-based agent settings management
 */

import { invoke } from '@tauri-apps/api/core';
import { getStore } from './store';
import type { AgentConfig, AgentSettings } from '../types/agent';
import { getDefaultAgentSettings, defaultShellAgent, AGENT_METADATA } from '../types/agent';
import { getLane } from './lane-api';
import type { AITool } from '../services/AIReviewService';

const AGENT_SETTINGS_KEY = 'agent_settings';

/**
 * Get current agent settings from the unified backend store
 */
export async function getAgentSettings(): Promise<AgentSettings> {
  try {
    const settings = await invoke<AgentSettings>('settings_get_agents');
    
    // Fallback/Migration: If backend returned default but we have data in the old store
    if (settings.installedAgents.length <= 1) {
      const store = await getStore();
      const oldSettings = await store.get<any>(AGENT_SETTINGS_KEY);
      
      if (oldSettings && oldSettings.installedAgents && oldSettings.installedAgents.length > 1) {
        console.info('[Settings] Migrating settings from legacy store to backend...');
        const migrated = migrateLegacySettings(oldSettings);
        await updateAgentSettings(migrated);
        return migrated;
      }
    }

    return settings;
  } catch (error) {
    console.error('Failed to get agent settings from backend:', error);
    return getDefaultAgentSettings();
  }
}

/**
 * Update agent settings in the unified backend store
 */
export async function updateAgentSettings(settings: AgentSettings): Promise<void> {
  try {
    await invoke('settings_update_agents', { settings });
    
    // Also update the legacy store for backward compatibility/safety for now
    const store = await getStore();
    await store.set(AGENT_SETTINGS_KEY, settings);
    await store.save();
  } catch (error) {
    console.error('Failed to update agent settings in backend:', error);
    throw error;
  }
}

/**
 * Internal helper to migrate old settings structures
 */
function migrateLegacySettings(settings: any): AgentSettings {
  const defaultSettings = getDefaultAgentSettings();

  // Migration: ensure installedAgents exists
  if (!settings.installedAgents) {
    if (settings.defaultAgent) {
      settings.installedAgents = [settings.defaultAgent];
    } else {
      settings.installedAgents = [...defaultSettings.installedAgents];
    }
  }

  // Ensure all installed agents have a name
  settings.installedAgents = settings.installedAgents.map((agent: AgentConfig) => {
    if (!agent.name) {
      const metadata = AGENT_METADATA[agent.agentType];
      return { ...agent, name: metadata?.preset.name || agent.agentType };
    }
    return agent;
  });

  // Migration: defaultAgent (object) -> defaultAgentName (string)
  if (settings.defaultAgent && typeof settings.defaultAgent === 'object') {
    settings.defaultAgentName = settings.defaultAgent.name || AGENT_METADATA[settings.defaultAgent.agentType as AgentType]?.preset.name || settings.defaultAgent.agentType;
    delete settings.defaultAgent;
  }

  // Ensure defaultAgentName is valid
  const hasValidDefault = settings.defaultAgentName && settings.installedAgents.some((a: AgentConfig) => a.name === settings.defaultAgentName);
  if (!hasValidDefault) {
    settings.defaultAgentName = settings.installedAgents[0]?.name || defaultSettings.defaultAgentName;
  }

  return settings as AgentSettings;
}

/**
 * Helper to get the actual default AgentConfig from settings
 */
export function getDefaultAgent(settings: AgentSettings): AgentConfig {
  const found = settings.installedAgents.find(a => a.name === settings.defaultAgentName);
  return found || settings.installedAgents[0] || defaultShellAgent;
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
  return getDefaultAgent(settings);
}

/**
 * Get the AITool that matches the user's configured default agent.
 */
export async function getReviewTool(): Promise<AITool> {
  const settings = await getAgentSettings();
  const defaultAgent = getDefaultAgent(settings);
  const metadata = AGENT_METADATA[defaultAgent.agentType];
  return metadata?.aiTool ?? 'claude';
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
