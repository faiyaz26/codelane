import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, Button, TextField } from '../ui';
import { updateLane, deleteLane } from '../../lib/lane-api';
import type { Lane } from '../../types/lane';

interface GitBranchInfo {
  current: string | null;
  branches: string[];
}

interface ProjectPanelProps {
  lanes: Lane[];
  activeLaneId: string | null;
  width: number;
  onLaneSelect: (laneId: string) => void;
  onLaneDeleted: (laneId: string) => void;
  onLaneRenamed: (lane: Lane) => void;
  onNewLane: () => void;
}

interface ProjectGroup {
  workingDir: string;
  projectName: string;
  lanes: Lane[];
}

export function ProjectPanel(props: ProjectPanelProps) {
  // Track which projects are expanded (default all expanded)
  const [expandedProjects, setExpandedProjects] = createSignal<Set<string>>(new Set());
  const [initialized, setInitialized] = createSignal(false);

  // Store branch info for each lane (laneId -> branch name)
  const [laneBranches, setLaneBranches] = createSignal<Map<string, string>>(new Map());

  // Menu state
  const [menuLaneId, setMenuLaneId] = createSignal<string | null>(null);

  // Rename modal state
  const [renameModalOpen, setRenameModalOpen] = createSignal(false);
  const [renameLane, setRenameLane] = createSignal<Lane | null>(null);
  const [renameValue, setRenameValue] = createSignal('');
  const [renameLoading, setRenameLoading] = createSignal(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [deleteLaneTarget, setDeleteLaneTarget] = createSignal<Lane | null>(null);
  const [deleteLoading, setDeleteLoading] = createSignal(false);

  // Group lanes by workingDir
  const projectGroups = createMemo(() => {
    const groups = new Map<string, Lane[]>();
    for (const lane of props.lanes) {
      const key = lane.workingDir;
      const existing = groups.get(key) || [];
      groups.set(key, [...existing, lane]);
    }
    return Array.from(groups.entries()).map(([workingDir, lanes]) => ({
      workingDir,
      projectName: workingDir.split('/').pop() || 'Unknown',
      lanes: lanes.sort((a, b) => a.name.localeCompare(b.name)),
    }));
  });

  // Auto-expand project containing active lane
  createMemo(() => {
    const activeLane = props.lanes.find(l => l.id === props.activeLaneId);
    if (activeLane && !initialized()) {
      setExpandedProjects(new Set(projectGroups().map(g => g.workingDir)));
      setInitialized(true);
    }
    if (activeLane) {
      setExpandedProjects(prev => {
        const next = new Set(prev);
        next.add(activeLane.workingDir);
        return next;
      });
    }
  });

  const toggleProject = (workingDir: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(workingDir)) {
        next.delete(workingDir);
      } else {
        next.add(workingDir);
      }
      return next;
    });
  };

  const isExpanded = (workingDir: string) => expandedProjects().has(workingDir);

  // Fetch branch info for all lanes
  onMount(async () => {
    const branchMap = new Map<string, string>();

    // Fetch branch info for each lane in parallel
    await Promise.all(
      props.lanes.map(async (lane) => {
        try {
          const branchInfo = await invoke<GitBranchInfo>('git_branch', {
            path: lane.worktreePath || lane.workingDir,
          });
          if (branchInfo.current) {
            branchMap.set(lane.id, branchInfo.current);
          }
        } catch (error) {
          console.error(`Failed to fetch branch for lane ${lane.id}:`, error);
        }
      })
    );

    setLaneBranches(branchMap);
  });

  // Get branch name for a lane
  const getLaneBranch = (laneId: string) => laneBranches().get(laneId);

  // Menu handlers
  const openMenu = (e: MouseEvent, laneId: string) => {
    e.stopPropagation();
    setMenuLaneId(menuLaneId() === laneId ? null : laneId);
  };

  const closeMenu = () => setMenuLaneId(null);

  // Rename handlers
  const openRenameModal = (lane: Lane) => {
    closeMenu();
    setRenameLane(lane);
    setRenameValue(lane.name);
    setRenameModalOpen(true);
  };

  const handleRename = async () => {
    const lane = renameLane();
    const newName = renameValue().trim();
    if (!lane || !newName) return;

    setRenameLoading(true);
    try {
      const updated = await updateLane({ laneId: lane.id, name: newName });
      props.onLaneRenamed(updated);
      setRenameModalOpen(false);
    } catch (err) {
      console.error('Failed to rename lane:', err);
    } finally {
      setRenameLoading(false);
    }
  };

  // Delete handlers
  const openDeleteModal = (lane: Lane) => {
    closeMenu();
    setDeleteLaneTarget(lane);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    const lane = deleteLaneTarget();
    if (!lane) return;

    setDeleteLoading(true);
    try {
      await deleteLane(lane.id);
      props.onLaneDeleted(lane.id);
      setDeleteModalOpen(false);
    } catch (err) {
      console.error('Failed to delete lane:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Close menu when clicking outside
  const handlePanelClick = () => closeMenu();

  return (
    <div
      class="flex-shrink-0 bg-zed-bg-panel flex flex-col overflow-hidden"
      style={{ width: `${props.width}px` }}
      onClick={handlePanelClick}
    >
      {/* Header */}
      <div class="panel-header justify-between pr-2">
        <span class="panel-header-title">Projects</span>
        <button
          class="w-5 h-5 flex items-center justify-center rounded text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover transition-colors"
          onClick={(e) => { e.stopPropagation(); props.onNewLane(); }}
          title="New Lane"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Project Tree */}
      <div class="flex-1 overflow-y-auto py-1">
        <Show when={projectGroups().length > 0} fallback={
          <div class="px-3 py-4 text-center text-sm text-zed-text-tertiary">
            No projects yet.<br />
            <button class="text-zed-accent-blue hover:underline mt-1" onClick={props.onNewLane}>
              Create a lane
            </button>
          </div>
        }>
          <For each={projectGroups()}>
            {(project) => (
              <div>
                {/* Project Header */}
                <button
                  class="w-full px-2 py-1 flex items-center gap-1.5 text-left hover:bg-zed-bg-hover transition-colors group"
                  onClick={() => toggleProject(project.workingDir)}
                >
                  {/* Expand/Collapse chevron */}
                  <svg
                    class={`w-3.5 h-3.5 text-zed-text-tertiary transition-transform ${isExpanded(project.workingDir) ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  {/* Cube icon */}
                  <svg class="w-4 h-4 text-zed-accent-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span class="text-sm text-zed-text-primary truncate">{project.projectName}</span>
                  <span class="text-xs text-zed-text-tertiary ml-auto">{project.lanes.length}</span>
                </button>

                {/* Lanes */}
                <Show when={isExpanded(project.workingDir)}>
                  <For each={project.lanes}>
                    {(lane) => {
                      const isActive = () => lane.id === props.activeLaneId;
                      const isMenuOpen = () => menuLaneId() === lane.id;
                      return (
                        <div class="relative group">
                          <button
                            class={`w-full pl-7 pr-2 py-1 flex items-center gap-1.5 text-left transition-colors ${
                              isActive()
                                ? 'bg-zed-bg-active text-zed-text-primary'
                                : 'hover:bg-zed-bg-hover text-zed-text-secondary hover:text-zed-text-primary'
                            }`}
                            onClick={() => props.onLaneSelect(lane.id)}
                          >
                            {/* Lane icon - branch if has branch, terminal otherwise */}
                            <Show when={getLaneBranch(lane.id)} fallback={
                              <svg class={`w-3.5 h-3.5 flex-shrink-0 ${isActive() ? 'text-zed-accent-blue' : 'text-zed-text-tertiary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            }>
                              <svg class={`w-3.5 h-3.5 flex-shrink-0 ${isActive() ? 'text-zed-accent-green' : 'text-zed-text-tertiary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c-1.657 0-3-1.343-3-3V4m6 4c0 1.657-1.343 3-3 3m0 0v10m0-10c1.657 0 3-1.343 3-3V4m-6 4c0-1.657 1.343-3 3-3m0 0V1m0 20h-3m3 0h3" />
                              </svg>
                            </Show>
                            <div class="flex-1 min-w-0 flex flex-col gap-1">
                              <span class="text-sm truncate">{lane.name}</span>
                              <Show when={getLaneBranch(lane.id) || lane.worktreePath}>
                                <div class="flex items-center gap-1">
                                  <Show when={getLaneBranch(lane.id)}>
                                    <span
                                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                      title={`Branch: ${getLaneBranch(lane.id)}`}
                                    >
                                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 9v6m0-6a3 3 0 1 0 0-6m0 6a3 3 0 1 1 0-6m14 6a3 3 0 1 1 0 6m0-6a3 3 0 1 0 0 6" />
                                      </svg>
                                      <span class="truncate max-w-[60px]">{getLaneBranch(lane.id)}</span>
                                    </span>
                                  </Show>
                                  <Show when={lane.worktreePath}>
                                    <span
                                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                      title={`Worktree: ${lane.worktreePath?.split('/').pop()}`}
                                    >
                                      <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                          stroke-width="2.5"
                                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                                        />
                                      </svg>
                                      <span class="truncate max-w-[50px]">{lane.worktreePath?.split('/').pop()}</span>
                                    </span>
                                  </Show>
                                </div>
                              </Show>
                            </div>

                            {/* 3-dot menu button */}
                            <div
                              class={`w-5 h-5 flex items-center justify-center rounded hover:bg-zed-bg-hover transition-all ${
                                isMenuOpen() ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}
                              onClick={(e) => openMenu(e, lane.id)}
                            >
                              <svg class="w-4 h-4 text-zed-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                          </button>

                          {/* Dropdown Menu */}
                          <Show when={isMenuOpen()}>
                            <div
                              class="absolute right-2 top-full mt-1 z-50 w-32 bg-zed-bg-overlay border border-zed-border-default rounded-md shadow-lg py-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                class="w-full px-3 py-1.5 text-left text-sm text-zed-text-primary hover:bg-zed-bg-hover transition-colors flex items-center gap-2"
                                onClick={() => openRenameModal(lane)}
                              >
                                <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Rename
                              </button>
                              <button
                                class="w-full px-3 py-1.5 text-left text-sm text-zed-accent-red hover:bg-zed-bg-hover transition-colors flex items-center gap-2"
                                onClick={() => openDeleteModal(lane)}
                              >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Rename Modal */}
      <Dialog
        open={renameModalOpen()}
        onOpenChange={setRenameModalOpen}
        title="Rename Lane"
      >
        <div class="space-y-4">
          <TextField
            label="Lane Name"
            value={renameValue()}
            onChange={setRenameValue}
            placeholder="Enter new name"
          />
          <div class="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setRenameModalOpen(false)}
              disabled={renameLoading()}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRename}
              disabled={renameLoading() || !renameValue().trim()}
            >
              {renameLoading() ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={deleteModalOpen()}
        onOpenChange={setDeleteModalOpen}
        title="Delete Lane"
      >
        <div class="space-y-4">
          <p class="text-sm text-zed-text-secondary">
            Are you sure you want to delete <span class="font-semibold text-zed-text-primary">"{deleteLaneTarget()?.name}"</span>?
          </p>
          <Show when={deleteLaneTarget()?.worktreePath}>
            <div class="p-3 rounded-md bg-zed-accent-yellow/10 border border-zed-accent-yellow/30 text-sm text-zed-text-secondary">
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-zed-accent-yellow mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p class="font-medium text-zed-accent-yellow">This lane has a worktree</p>
                  <p class="mt-1">The worktree will be removed, but the branch <span class="font-mono text-zed-text-primary">"{deleteLaneTarget()?.branch}"</span> will be preserved.</p>
                </div>
              </div>
            </div>
          </Show>
          <p class="text-sm text-zed-text-tertiary">
            This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteLoading()}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={deleteLoading()}
              class="!bg-zed-accent-red hover:!bg-zed-accent-red/90"
            >
              {deleteLoading() ? 'Deleting...' : 'Delete Lane'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
