/**
 * Lane API - SQLite-based lane management
 */

import { getDatabase } from './db';
import type { Lane, CreateLaneParams, UpdateLaneParams } from '../types/lane';
import { v4 as uuidv4 } from 'uuid';
import { isGitRepo, branchExists, createBranch, createWorktree, removeWorktree } from './git-api';

/**
 * Creates a new lane
 */
export async function createLane(params: CreateLaneParams): Promise<Lane> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);
  const id = uuidv4();

  // Validate working directory (basic check)
  if (!params.workingDir || params.workingDir.trim() === '') {
    throw new Error('Working directory is required');
  }

  let worktreePath: string | undefined;
  let branch: string | undefined;

  // Handle branch/worktree creation if branch is specified
  if (params.branch && params.branch.trim()) {
    branch = params.branch.trim();

    // Check if directory is a git repo
    const isRepo = await isGitRepo(params.workingDir);
    if (isRepo) {
      // Check if branch exists, create if not
      const exists = await branchExists(params.workingDir, branch);
      if (!exists) {
        await createBranch(params.workingDir, branch);
      }

      // Create worktree - backend computes path in ~/.codelane/worktrees/
      worktreePath = await createWorktree(params.workingDir, branch);
    } else {
      // Not a git repo, ignore branch
      branch = undefined;
    }
  }

  // Default config as JSON
  const defaultConfig = JSON.stringify({
    env: [],
    lspServers: [],
  });

  // Insert lane with config
  await db.execute(
    `INSERT INTO lanes (id, name, working_dir, worktree_path, branch, config, created_at, updated_at, last_accessed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.workingDir, worktreePath || null, branch || null, defaultConfig, now, now, now]
  );

  // Return the created lane
  return {
    id,
    name: params.name,
    workingDir: params.workingDir,
    worktreePath,
    branch,
    createdAt: now,
    updatedAt: now,
    config: {
      env: [],
      lspServers: [],
    },
  };
}

/**
 * Lists all lanes, sorted by sort_order (or updated_at if sort_order is null)
 */
export async function listLanes(): Promise<Lane[]> {
  const db = await getDatabase();

  const rows = await db.select<Array<{
    id: string;
    name: string;
    working_dir: string;
    worktree_path: string | null;
    branch: string | null;
    config: string;
    created_at: number;
    updated_at: number;
  }>>(
    `SELECT id, name, working_dir, worktree_path, branch, config, created_at, updated_at
     FROM lanes
     ORDER BY COALESCE(sort_order, 999999), updated_at DESC`
  );

  return rows.map(row => {
    const config = JSON.parse(row.config || '{}');
    return {
      id: row.id,
      name: row.name,
      workingDir: row.working_dir,
      worktreePath: row.worktree_path || undefined,
      branch: row.branch || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      config: {
        agentOverride: config.agentOverride,
        env: config.env || [],
        lspServers: config.lspServers || [],
      },
    };
  });
}

/**
 * Gets a specific lane by ID
 */
export async function getLane(laneId: string): Promise<Lane> {
  const db = await getDatabase();

  const rows = await db.select<Array<{
    id: string;
    name: string;
    working_dir: string;
    worktree_path: string | null;
    branch: string | null;
    config: string;
    created_at: number;
    updated_at: number;
  }>>(
    `SELECT id, name, working_dir, worktree_path, branch, config, created_at, updated_at
     FROM lanes
     WHERE id = ?`,
    [laneId]
  );

  if (rows.length === 0) {
    throw new Error(`Lane not found: ${laneId}`);
  }

  const row = rows[0];
  const config = JSON.parse(row.config || '{}');
  return {
    id: row.id,
    name: row.name,
    workingDir: row.working_dir,
    worktreePath: row.worktree_path || undefined,
    branch: row.branch || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    config: {
      agentOverride: config.agentOverride,
      env: config.env || [],
      lspServers: config.lspServers || [],
    },
  };
}

/**
 * Updates a lane
 */
export async function updateLane(params: UpdateLaneParams): Promise<Lane> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  // Build update query dynamically based on provided fields
  const updates: string[] = [];
  const values: any[] = [];

  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }

  if (params.workingDir !== undefined) {
    updates.push('working_dir = ?');
    values.push(params.workingDir);
  }

  updates.push('updated_at = ?');
  values.push(now);

  values.push(params.laneId);

  if (updates.length > 0) {
    await db.execute(
      `UPDATE lanes SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  // Return updated lane
  return getLane(params.laneId);
}

/**
 * Deletes a lane
 */
export async function deleteLane(laneId: string): Promise<void> {
  const db = await getDatabase();

  // Get lane info first to check for worktree
  const lanes = await db.select<Array<{
    working_dir: string;
    worktree_path: string | null;
    branch: string | null;
  }>>(
    'SELECT working_dir, worktree_path, branch FROM lanes WHERE id = ?',
    [laneId]
  );

  if (lanes.length > 0) {
    const lane = lanes[0];
    // If lane has worktree, try to remove it
    if (lane.worktree_path && lane.branch) {
      try {
        await removeWorktree(lane.working_dir, lane.worktree_path);
      } catch (e) {
        console.warn('Failed to remove worktree:', e);
      }
    }
  }

  await db.execute('DELETE FROM lanes WHERE id = ?', [laneId]);
}

/**
 * Update last accessed time for a lane
 */
export async function touchLane(laneId: string): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db.execute(
    'UPDATE lanes SET last_accessed = ? WHERE id = ?',
    [now, laneId]
  );
}

/**
 * Update sort order for lanes
 */
export async function updateLaneOrder(laneIds: string[]): Promise<void> {
  const db = await getDatabase();

  // Update each lane's sort_order based on its position in the array
  for (let i = 0; i < laneIds.length; i++) {
    await db.execute(
      'UPDATE lanes SET sort_order = ? WHERE id = ?',
      [i, laneIds[i]]
    );
  }
}

/**
 * Update lane configuration
 */
export async function updateLaneConfig(laneId: string, config: Lane['config']): Promise<void> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  await db.execute(
    'UPDATE lanes SET config = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(config), now, laneId]
  );
}
