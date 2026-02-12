/**
 * Agent status tracking types
 */

/** Possible agent statuses for a lane */
export type AgentStatus = 'idle' | 'working' | 'done' | 'waiting_for_input' | 'error';

/** All supported agent types for detection */
export type DetectableAgentType = 'claude' | 'cursor' | 'aider' | 'opencode' | 'codex' | 'gemini' | 'shell';

/** Status change event emitted by the status manager */
export interface AgentStatusChange {
  laneId: string;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
  agentType: DetectableAgentType;
  timestamp: number;
}

/** Notification preferences (stored in localStorage) */
export interface AgentNotificationSettings {
  notifyOnDone: boolean;
  notifyOnWaitingForInput: boolean;
  notifyOnError: boolean;
  onlyWhenUnfocused: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: AgentNotificationSettings = {
  notifyOnDone: false,
  notifyOnWaitingForInput: false,
  notifyOnError: false,
  onlyWhenUnfocused: true,
};
