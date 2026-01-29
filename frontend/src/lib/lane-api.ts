/**
 * Lane API - Wrapper around Tauri commands for lane management
 */

import { invoke } from '@tauri-apps/api/core';
import type { Lane, CreateLaneParams, UpdateLaneParams } from '../types/lane';

/**
 * Creates a new lane
 */
export async function createLane(params: CreateLaneParams): Promise<Lane> {
  return invoke<Lane>('lane_create', params);
}

/**
 * Lists all lanes
 */
export async function listLanes(): Promise<Lane[]> {
  return invoke<Lane[]>('lane_list');
}

/**
 * Gets a specific lane by ID
 */
export async function getLane(laneId: string): Promise<Lane> {
  return invoke<Lane>('lane_get', { lane_id: laneId });
}

/**
 * Updates a lane
 */
export async function updateLane(params: UpdateLaneParams): Promise<Lane> {
  return invoke<Lane>('lane_update', params);
}

/**
 * Deletes a lane
 */
export async function deleteLane(laneId: string): Promise<void> {
  return invoke<void>('lane_delete', { lane_id: laneId });
}
