/**
 * Service for managing agent hooks.
 *
 * Provides methods to:
 * - Install/uninstall hook scripts for agents
 * - Check hook installation status
 * - Listen for hook events from agents
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { HookEvent, HookStatus } from '../types/hooks';
import type { AgentType } from '../types/agent';

class HookService {
  /**
   * Install hooks for an agent.
   * This creates a hook script and updates the agent's configuration.
   */
  async installHooks(agentType: AgentType): Promise<void> {
    await invoke('hooks_install', { agentType });
  }

  /**
   * Uninstall hooks for an agent.
   * Removes the hook script and cleans up configuration.
   */
  async uninstallHooks(agentType: AgentType): Promise<void> {
    await invoke('hooks_uninstall', { agentType });
  }

  /**
   * Check if hooks are installed for an agent.
   */
  async checkStatus(agentType: AgentType): Promise<HookStatus> {
    return await invoke<HookStatus>('hooks_check_status', { agentType });
  }

  /**
   * Get hook status for all supported agents.
   */
  async getAllStatus(): Promise<Record<AgentType, HookStatus>> {
    const agents: AgentType[] = ['claude', 'codex', 'gemini', 'aider', 'cursor', 'opencode'];
    const statuses = await Promise.all(agents.map((agent) => this.checkStatus(agent)));

    return Object.fromEntries(statuses.map((status) => [status.agentType, status])) as Record<
      AgentType,
      HookStatus
    >;
  }

  /**
   * Listen for hook events from agents.
   * Returns an unsubscribe function.
   */
  onHookEvent(callback: (event: HookEvent) => void): () => void {
    let unlisten: (() => void) | null = null;

    listen<HookEvent>('hook-event', (event) => {
      callback(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }
}

export const hookService = new HookService();
