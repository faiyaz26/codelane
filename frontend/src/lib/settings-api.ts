/**
 * Settings API - SQLite-based agent settings management
 */

import { invoke } from '@tauri-apps/api/core';
import { getDatabase } from './db';
import type { AgentConfig, AgentSettings } from '../types/agent';
import { getDefaultAgentSettings } from '../types/agent';
import { getLane } from './lane-api';

const AGENT_SETTINGS_KEY = 'agent_settings';

/**
 * Get current agent settings from database
 */
export async function getAgentSettings(): Promise<AgentSettings> {
  const db = await getDatabase();

  const rows = await db.select<Array<{ value: string }>>(
    'SELECT value FROM settings WHERE key = ?',
    [AGENT_SETTINGS_KEY]
  );

  if (rows.length === 0) {
    // Return default settings if not found
    return getDefaultAgentSettings();
  }

  return JSON.parse(rows[0].value);
}

/**
 * Update agent settings in database
 */
export async function updateAgentSettings(settings: AgentSettings): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [AGENT_SETTINGS_KEY, JSON.stringify(settings), now]
  );
}

/**
 * Get resolved agent config for a specific lane
 * Resolution: lane override -> global default
 */
export async function getLaneAgentConfig(laneId: string): Promise<AgentConfig> {
  const lane = await getLane(laneId);

  // If lane has override, use it
  if (lane.config.agentOverride) {
    return lane.config.agentOverride;
  }

  // Otherwise use global default
  const settings = await getAgentSettings();
  return settings.defaultAgent;
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
