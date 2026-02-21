/**
 * Lane API - Store-based lane management
 */

import { getStore } from './store';
import type { Lane, LaneConfig, CreateLaneParams, UpdateLaneParams } from '../types/lane';
import { v4 as uuidv4 } from 'uuid';
import { isGitRepo, branchExists, createBranch, createWorktree, removeWorktree, getDefaultBranch, fetchBranch } from './git-api';

const LANES_KEY = 'lanes';

/**
 * Load lanes array from store
 */
async function loadLanes(): Promise<Lane[]> {
  const store = await getStore();
  return (await store.get<Lane[]>(LANES_KEY)) || [];
}

/**
 * Save lanes array to store
 */
async function saveLanes(lanes: Lane[]): Promise<void> {
  const store = await getStore();
  await store.set(LANES_KEY, lanes);
  await store.save();
}

/**
 * Creates a new lane
 */
export async function createLane(params: CreateLaneParams): Promise<Lane> {
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
      // For PR review lanes, fetch the remote branch first so we get the actual PR commits
      if (params.laneType === 'pr_review') {
        try {
          await fetchBranch(params.workingDir, branch);
        } catch (e) {
          console.warn('Failed to fetch remote branch, continuing with local:', e);
        }
        // Also fetch the base branch to ensure diff works correctly
        if (params.prMetadata?.baseBranch) {
          try {
            await fetchBranch(params.workingDir, params.prMetadata.baseBranch);
          } catch {
            // Base branch is likely already available locally
          }
        }
      }

      // Check if branch exists, create if not
      const exists = await branchExists(params.workingDir, branch);
      if (!exists) {
        // Create branch from default branch (main/master) instead of HEAD
        let baseBranch: string | undefined;
        try {
          baseBranch = await getDefaultBranch(params.workingDir);
        } catch {
          // Fall back to creating from HEAD if we can't determine default branch
        }
        await createBranch(params.workingDir, branch, baseBranch);
      }

      // Create worktree - backend computes path in ~/.codelane/worktrees/
      worktreePath = await createWorktree(params.workingDir, branch);
    } else {
      // Not a git repo, ignore branch
      branch = undefined;
    }
  }

  const lane: Lane = {
    id,
    name: params.name,
    workingDir: params.workingDir,
    worktreePath,
    branch,
    ...(params.laneType && { laneType: params.laneType }),
    ...(params.prMetadata && { prMetadata: params.prMetadata }),
    createdAt: now,
    updatedAt: now,
    config: {
      env: [],
      lspServers: [],
    },
  };

  const lanes = await loadLanes();
  lanes.push(lane);
  await saveLanes(lanes);

  return lane;
}

/**
 * Lists all lanes, sorted by sort_order (or updated_at if sort_order is null)
 */
export async function listLanes(): Promise<Lane[]> {
  const lanes = await loadLanes();

  // Ensure config defaults and backfill laneType for legacy PR lanes
  return lanes.map(lane => ({
    ...lane,
    worktreePath: lane.worktreePath || undefined,
    branch: lane.branch || undefined,
    laneType: lane.laneType || (lane.prMetadata ? 'pr_review' : undefined),
    prMetadata: lane.prMetadata || undefined,
    config: {
      agentOverride: lane.config?.agentOverride,
      env: lane.config?.env || [],
      lspServers: lane.config?.lspServers || [],
      tabs: lane.config?.tabs,
      activeTabId: lane.config?.activeTabId,
    },
  }));
}

/**
 * Gets a specific lane by ID
 */
export async function getLane(laneId: string): Promise<Lane> {
  const lanes = await loadLanes();
  const lane = lanes.find(l => l.id === laneId);

  if (!lane) {
    throw new Error(`Lane not found: ${laneId}`);
  }

  return {
    ...lane,
    worktreePath: lane.worktreePath || undefined,
    branch: lane.branch || undefined,
    laneType: lane.laneType || (lane.prMetadata ? 'pr_review' : undefined),
    prMetadata: lane.prMetadata || undefined,
    config: {
      agentOverride: lane.config?.agentOverride,
      env: lane.config?.env || [],
      lspServers: lane.config?.lspServers || [],
      tabs: lane.config?.tabs,
      activeTabId: lane.config?.activeTabId,
    },
  };
}

/**
 * Updates a lane
 */
export async function updateLane(params: UpdateLaneParams): Promise<Lane> {
  const now = Math.floor(Date.now() / 1000);
  const lanes = await loadLanes();
  const index = lanes.findIndex(l => l.id === params.laneId);

  if (index === -1) {
    throw new Error(`Lane not found: ${params.laneId}`);
  }

  if (params.name !== undefined) {
    lanes[index].name = params.name;
  }
  if (params.workingDir !== undefined) {
    lanes[index].workingDir = params.workingDir;
  }
  lanes[index].updatedAt = now;

  await saveLanes(lanes);
  return getLane(params.laneId);
}

/**
 * Deletes a lane
 * Removes the lane from the store immediately, then cleans up worktree in the background.
 */
export async function deleteLane(laneId: string): Promise<void> {
  const lanes = await loadLanes();
  const lane = lanes.find(l => l.id === laneId);

  // Remove from store immediately so the UI updates fast
  const filtered = lanes.filter(l => l.id !== laneId);
  await saveLanes(filtered);

  // Clean up worktree in the background (don't block UI)
  if (lane?.worktreePath && lane?.branch) {
    removeWorktree(lane.workingDir, lane.worktreePath).catch((e) => {
      console.warn('Failed to remove worktree:', e);
    });
  }
}

/**
 * Update last accessed time for a lane
 */
export async function touchLane(laneId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const lanes = await loadLanes();
  const lane = lanes.find(l => l.id === laneId);

  if (lane) {
    (lane as Lane & { lastAccessed?: number }).lastAccessed = now;
    await saveLanes(lanes);
  }
}

/**
 * Update sort order for lanes
 */
export async function updateLaneOrder(laneIds: string[]): Promise<void> {
  const lanes = await loadLanes();

  // Sort lanes according to the given order
  const ordered: Lane[] = [];
  for (const id of laneIds) {
    const lane = lanes.find(l => l.id === id);
    if (lane) ordered.push(lane);
  }

  // Add any lanes not in the order list at the end
  for (const lane of lanes) {
    if (!laneIds.includes(lane.id)) {
      ordered.push(lane);
    }
  }

  await saveLanes(ordered);
}

/**
 * Update lane configuration
 */
/**
 * Convert a PR review lane to a feature lane (keeps branch/worktree, removes PR metadata)
 */
export async function convertToFeatureLane(laneId: string): Promise<Lane> {
  const now = Math.floor(Date.now() / 1000);
  const lanes = await loadLanes();
  const lane = lanes.find(l => l.id === laneId);

  if (!lane) {
    throw new Error(`Lane not found: ${laneId}`);
  }

  delete lane.laneType;
  delete lane.prMetadata;
  lane.updatedAt = now;
  await saveLanes(lanes);

  return getLane(laneId);
}

/**
 * Update lane configuration
 */
export async function updateLaneConfig(laneId: string, config: LaneConfig): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const lanes = await loadLanes();
  const lane = lanes.find(l => l.id === laneId);

  if (lane) {
    lane.config = config;
    lane.updatedAt = now;
    await saveLanes(lanes);
  }
}
