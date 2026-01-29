/**
 * Lane type - represents a project workspace with its own terminal and AI agents
 */
export interface Lane {
  id: string;
  name: string;
  working_dir: string;
  created_at: number;
  updated_at: number;
}

/**
 * Parameters for creating a new lane
 */
export interface CreateLaneParams {
  name: string;
  working_dir: string;
}

/**
 * Parameters for updating an existing lane
 */
export interface UpdateLaneParams {
  lane_id: string;
  name?: string;
  working_dir?: string;
}
