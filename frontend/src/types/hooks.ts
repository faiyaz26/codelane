import type { AgentType } from './agent';

/**
 * Hook event received from agent hook scripts.
 * Emitted when agents (Claude, Codex, Gemini) need user input.
 */
export interface HookEvent {
  /** Lane ID where the agent is running */
  laneId: string;
  /** Type of agent that triggered the hook */
  agentType: AgentType;
  /** Type of event */
  eventType: 'permission_prompt' | 'idle_prompt' | 'waiting_for_input';
  /** Unix timestamp when event occurred */
  timestamp: number;
  /** Optional message from the agent */
  message?: string;
}

/**
 * Hook installation status for an agent
 */
export interface HookStatus {
  /** Agent type */
  agentType: AgentType;
  /** Whether hooks are currently installed */
  installed: boolean;
  /** Whether this agent supports hooks */
  supported: boolean;
}
