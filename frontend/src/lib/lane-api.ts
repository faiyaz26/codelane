/**
 * Lane API - SQLite-based lane management
 */

import { getDatabase } from './db';
import type { Lane, CreateLaneParams, UpdateLaneParams } from '../types/lane';
import { v4 as uuidv4 } from 'uuid';

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

  // Insert lane
  await db.execute(
    `INSERT INTO lanes (id, name, working_dir, created_at, updated_at, last_accessed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.workingDir, now, now, now]
  );

  // Insert default config
  await db.execute(
    `INSERT INTO lane_configs (lane_id, agent_override, env, lsp_servers)
     VALUES (?, NULL, '[]', '[]')`,
    [id]
  );

  // Return the created lane
  return {
    id,
    name: params.name,
    workingDir: params.workingDir,
    createdAt: now,
    updatedAt: now,
    config: {
      env: [],
      lspServers: [],
    },
  };
}

/**
 * Lists all lanes, sorted by most recently updated
 */
export async function listLanes(): Promise<Lane[]> {
  const db = await getDatabase();

  const rows = await db.select<Array<{
    id: string;
    name: string;
    working_dir: string;
    created_at: number;
    updated_at: number;
    agent_override: string | null;
    env: string | null;
    lsp_servers: string | null;
  }>>(
    `SELECT
      l.id, l.name, l.working_dir, l.created_at, l.updated_at,
      lc.agent_override, lc.env, lc.lsp_servers
     FROM lanes l
     LEFT JOIN lane_configs lc ON l.id = lc.lane_id
     ORDER BY l.updated_at DESC`
  );

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    workingDir: row.working_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    config: {
      agentOverride: row.agent_override ? JSON.parse(row.agent_override) : undefined,
      env: row.env ? JSON.parse(row.env) : [],
      lspServers: row.lsp_servers ? JSON.parse(row.lsp_servers) : [],
    },
  }));
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
    created_at: number;
    updated_at: number;
    agent_override: string | null;
    env: string | null;
    lsp_servers: string | null;
  }>>(
    `SELECT
      l.id, l.name, l.working_dir, l.created_at, l.updated_at,
      lc.agent_override, lc.env, lc.lsp_servers
     FROM lanes l
     LEFT JOIN lane_configs lc ON l.id = lc.lane_id
     WHERE l.id = ?`,
    [laneId]
  );

  if (rows.length === 0) {
    throw new Error(`Lane not found: ${laneId}`);
  }

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    workingDir: row.working_dir,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    config: {
      agentOverride: row.agent_override ? JSON.parse(row.agent_override) : undefined,
      env: row.env ? JSON.parse(row.env) : [],
      lspServers: row.lsp_servers ? JSON.parse(row.lsp_servers) : [],
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

  // SQLite will automatically delete lane_configs due to CASCADE
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
