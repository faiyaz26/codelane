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

  // Default config as JSON
  const defaultConfig = JSON.stringify({
    env: [],
    lspServers: [],
  });

  // Insert lane with config
  await db.execute(
    `INSERT INTO lanes (id, name, working_dir, config, created_at, updated_at, last_accessed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.workingDir, defaultConfig, now, now, now]
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
 * Lists all lanes, sorted by sort_order (or updated_at if sort_order is null)
 */
export async function listLanes(): Promise<Lane[]> {
  const db = await getDatabase();

  const rows = await db.select<Array<{
    id: string;
    name: string;
    working_dir: string;
    config: string;
    created_at: number;
    updated_at: number;
  }>>(
    `SELECT id, name, working_dir, config, created_at, updated_at
     FROM lanes
     ORDER BY COALESCE(sort_order, 999999), updated_at DESC`
  );

  return rows.map(row => {
    const config = JSON.parse(row.config || '{}');
    return {
      id: row.id,
      name: row.name,
      workingDir: row.working_dir,
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
    config: string;
    created_at: number;
    updated_at: number;
  }>>(
    `SELECT id, name, working_dir, config, created_at, updated_at
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
