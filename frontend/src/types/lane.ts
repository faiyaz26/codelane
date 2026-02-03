import { AgentConfig } from './agent';

/**
 * Tab type - what kind of content the tab displays
 */
export type TabType = 'terminal' | 'extension';

/**
 * Tab configuration
 */
export interface Tab {
  id: string;
  type: TabType;
  title: string;
  sortOrder: number;
  createdAt: number;
}

/**
 * Lane configuration
 */
export interface LaneConfig {
  agentOverride?: AgentConfig;
  env?: [string, string][];
  lspServers?: string[];
  tabs?: Tab[];
  activeTabId?: string;
}

/**
 * Lane type - represents a project workspace with its own terminal and AI agents
 */
export interface Lane {
  id: string;
  name: string;
  workingDir: string;
  worktreePath?: string;  // Worktree path (if branch specified)
  branch?: string;        // Branch name (if using worktree)
  createdAt: number;
  updatedAt: number;
  config?: LaneConfig;
}

/**
 * Parameters for creating a new lane
 */
export interface CreateLaneParams {
  name: string;
  workingDir: string;
  branch?: string;  // Optional branch for worktree
}

/**
 * Parameters for updating an existing lane
 */
export interface UpdateLaneParams {
  laneId: string;
  name?: string;
  workingDir?: string;
}
