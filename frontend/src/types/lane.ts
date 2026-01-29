/**
 * Lane type - represents a project workspace with its own terminal and AI agents
 */
export interface Lane {
  id: string;
  name: string;
  workingDir: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Parameters for creating a new lane
 */
export interface CreateLaneParams {
  name: string;
  workingDir: string;
}

/**
 * Parameters for updating an existing lane
 */
export interface UpdateLaneParams {
  laneId: string;
  name?: string;
  workingDir?: string;
}
