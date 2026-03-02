/**
 * Lane API - Backend-based lane management
 */

import { invoke } from '@tauri-apps/api/core';
import { getStore } from './store';
import type { Lane, LaneConfig, CreateLaneParams, UpdateLaneParams } from '../types/lane';
import { isGitRepo, branchExists, createBranch, createWorktree, removeWorktree, getDefaultBranch, fetchBranch, cloneRepo, getRemoteUrl, fetchPrBranch } from './git-api';

const LANES_KEY = 'lanes';
const MIGRATION_DONE_KEY = 'lanes_migration_done';

/**
 * Normalizes a git URL for comparison (removes protocol, .git suffix, and trailing slashes)
 */
function normalizeGitUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/:/, '/')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

/**
 * Migrate lanes from local store to backend
 */
export async function migrateLanesToBackend(): Promise<void> {
  const store = await getStore();
  const isMigrated = await store.get<boolean>(MIGRATION_DONE_KEY);
  
  if (isMigrated) {
    return;
  }

  console.info('[LaneAPI] Starting migration of lanes to backend...');
  const lanes = (await store.get<Lane[]>(LANES_KEY)) || [];
  
  if (lanes.length > 0) {
    try {
      await invoke('lane_batch_create', { lanesToCreate: lanes });
      console.info(`[LaneAPI] Successfully migrated ${lanes.length} lanes to backend.`);
    } catch (e) {
      console.error('[LaneAPI] Migration failed:', e);
      // Don't mark as done if it failed, so we can retry
      return;
    }
  } else {
    console.info('[LaneAPI] No lanes to migrate.');
  }

  await store.set(MIGRATION_DONE_KEY, true);
  await store.save();
}

/**
 * Creates a new lane
 */
export async function createLane(params: CreateLaneParams): Promise<Lane> {
  // Validate working directory (basic check)
  if (!params.workingDir || params.workingDir.trim() === '') {
    throw new Error('Working directory is required');
  }

  let workingDir = params.workingDir.trim();
  let worktreePath: string | undefined;
  let branch: string | undefined;

  // For PR review lanes, ensure the repository exists and matches
  if (params.laneType === 'pr_review' && params.prMetadata) {
    const prRepoUrl = params.prMetadata.repoUrl;
    let needsClone = false;

    const isRepo = await isGitRepo(workingDir);
    if (!isRepo) {
      needsClone = true;
      const repoName = params.prMetadata.repoName.split('/').pop() || 'repo';
      if (!workingDir.endsWith(repoName)) {
        workingDir = `${workingDir.replace(/\/$/, '')}/${repoName}`;
      }
    } else {
      // Check if remote matches
      try {
        const remoteUrl = await getRemoteUrl(workingDir);
        if (normalizeGitUrl(remoteUrl) !== normalizeGitUrl(prRepoUrl)) {
          console.warn(`Local repo remote (${remoteUrl}) does not match PR repo (${prRepoUrl}).`);
          needsClone = true;
          
          // If the current directory is a different repo, clone into a subdirectory
          const repoName = params.prMetadata.repoName.split('/').pop() || 'repo';
          workingDir = `${workingDir.replace(/\/$/, '')}/${repoName}`;
        }
      } catch (e) {
        needsClone = true;
      }
    }

    if (needsClone) {
      console.info(`Cloning ${prRepoUrl} into ${workingDir}...`);
      await cloneRepo(prRepoUrl, workingDir);
    }
  }

  // Handle branch/worktree creation if branch is specified
  if (params.branch && params.branch.trim()) {
    branch = params.branch.trim();

    // Check if directory is a git repo
    const isRepo = await isGitRepo(workingDir);
    if (isRepo) {
      // For PR review lanes, fetch the remote branch first
      if (params.laneType === 'pr_review' && params.prMetadata) {
        try {
          await fetchPrBranch(workingDir, params.prMetadata.number, branch);
        } catch (e) {
          console.warn('Failed to fetch remote PR branch, continuing with local:', e);
        }
        if (params.prMetadata?.baseBranch) {
          try {
            await fetchBranch(workingDir, params.prMetadata.baseBranch);
          } catch {
            // Base branch likely available
          }
        }
      }

      // Check if branch exists, create if not
      const exists = await branchExists(workingDir, branch);
      if (!exists) {
        let baseBranch: string | undefined;
        try {
          baseBranch = await getDefaultBranch(workingDir);
        } catch {
          // Fall back to creating from HEAD
        }
        await createBranch(workingDir, branch, baseBranch);
      }

      // Create worktree
      worktreePath = await createWorktree(workingDir, branch);
    } else {
      branch = undefined;
    }
  }

  // Create in backend
  const lane = await invoke<Lane>('lane_create', {
    name: params.name,
    workingDir,
    worktreePath: worktreePath || null,
    branch: branch || null,
    laneType: params.laneType || 'feature',
    prMetadata: params.prMetadata || null,
  });

  return lane;
}

/**
 * Lists all lanes
 */
export async function listLanes(): Promise<Lane[]> {
  await migrateLanesToBackend();
  return await invoke<Lane[]>('lane_list');
}

/**
 * Gets a specific lane by ID
 */
export async function getLane(laneId: string): Promise<Lane> {
  return await invoke<Lane>('lane_get', { laneId });
}

/**
 * Updates a lane
 */
export async function updateLane(params: UpdateLaneParams): Promise<Lane> {
  return await invoke<Lane>('lane_update', {
    laneId: params.laneId,
    name: params.name || null,
    workingDir: params.workingDir || null,
    lastAccessed: null,
    sortOrder: null,
    laneType: null,
  });
}

/**
 * Deletes a lane
 */
export async function deleteLane(laneId: string): Promise<void> {
  // Get lane info first to clean up worktree
  let lane: Lane | undefined;
  try {
    lane = await getLane(laneId);
  } catch (e) {
    // Ignore if not found
  }

  await invoke('lane_delete', { laneId });

  // Clean up worktree in the background
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
  await invoke('lane_touch', { laneId });
}

/**
 * Update sort order for lanes
 */
export async function updateLaneOrder(laneIds: string[]): Promise<void> {
  // Update each lane with its new sort order
  await Promise.all(
    laneIds.map((id, index) => 
      invoke('lane_update', {
        laneId: id,
        name: null,
        workingDir: null,
        lastAccessed: null,
        sortOrder: index,
        laneType: null,
      })
    )
  );
}

/**
 * Convert a PR review lane to a feature lane
 */
export async function convertToFeatureLane(laneId: string): Promise<Lane> {
  return await invoke<Lane>('lane_update_type', { 
    laneId, 
    laneType: 'feature',
    clearPrMetadata: true 
  });
}

/**
 * Update lane configuration
 */
export async function updateLaneConfig(laneId: string, config: LaneConfig): Promise<void> {
  await invoke('lane_update_config', { laneId, config });
}
