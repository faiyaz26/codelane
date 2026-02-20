import { createSignal, Show, For, createEffect, onCleanup } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, Button, TextField } from '../ui';
import { createLane } from '../../lib/lane-api';
import { isGitRepo, listWorktrees, removeWorktree, getGitBranch, getDefaultBranch } from '../../lib/git-api';
import { WorktreeConflictDialog } from '../WorktreeConflictDialog';
import type { Lane } from '../../types/lane';
import type { GitBranchInfo } from '../../types/git';

interface WorktreeConflict {
  branch: string;
  existingPath: string;
}

// Rotating placeholder examples
const PLACEHOLDER_EXAMPLES = [
  'Add user authentication',
  'Fix checkout bug',
  'Refactor API layer',
  'Update dependencies',
  'Add dark mode support',
  'Improve search performance',
  'Write unit tests',
  'Setup CI/CD pipeline',
  'Migrate to TypeScript',
  'Add payment integration',
];

interface CreateLaneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaneCreated: (lane: Lane) => void;
}

export function CreateLaneDialog(props: CreateLaneDialogProps) {
  const [name, setName] = createSignal('');
  const [workingDir, setWorkingDir] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);
  const [branch, setBranch] = createSignal('');
  const [isGitRepoDir, setIsGitRepoDir] = createSignal(false);
  const [checkingGitRepo, setCheckingGitRepo] = createSignal(false);
  const [placeholderIndex, setPlaceholderIndex] = createSignal(
    Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)
  );
  const [worktreeConflict, setWorktreeConflict] = createSignal<WorktreeConflict | null>(null);
  const [branches, setBranches] = createSignal<string[]>([]);
  const [defaultBranch, setDefaultBranch] = createSignal<string>('main');
  const [showBranchDropdown, setShowBranchDropdown] = createSignal(false);
  const [isExistingBranch, setIsExistingBranch] = createSignal(false);

  // Rotate placeholder when dialog is open
  createEffect(() => {
    if (props.open) {
      const interval = setInterval(() => {
        setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
      }, 2500);
      onCleanup(() => clearInterval(interval));
    }
  });

  const currentPlaceholder = () => PLACEHOLDER_EXAMPLES[placeholderIndex()];

  // Check if working directory is a git repo when it changes
  createEffect(async () => {
    const dir = workingDir();
    if (dir && dir.trim()) {
      setCheckingGitRepo(true);
      try {
        const result = await isGitRepo(dir);
        setIsGitRepoDir(result);
        if (!result) {
          setBranch('');
          setBranches([]);
          setIsExistingBranch(false);
        } else {
          // Fetch branches and default branch in parallel
          const [branchInfo, defBranch] = await Promise.all([
            getGitBranch(dir).catch((): GitBranchInfo => ({ current: null, branches: [] })),
            getDefaultBranch(dir).catch(() => 'main'),
          ]);
          setBranches(branchInfo.branches);
          setDefaultBranch(defBranch);
        }
      } catch (e) {
        setIsGitRepoDir(false);
        setBranch('');
        setBranches([]);
        setIsExistingBranch(false);
      } finally {
        setCheckingGitRepo(false);
      }
    } else {
      setIsGitRepoDir(false);
      setBranch('');
      setBranches([]);
      setIsExistingBranch(false);
    }
  });

  // Track whether the typed branch is an existing one
  createEffect(() => {
    const branchName = branch().trim();
    const allBranches = branches();
    setIsExistingBranch(branchName !== '' && allBranches.includes(branchName));
  });

  // Filtered branches for dropdown (default branch shown first)
  const filteredBranches = () => {
    const query = branch().trim().toLowerCase();
    const allBranches = branches();
    const defBranch = defaultBranch();
    const filtered = query
      ? allBranches.filter(b => b.toLowerCase().includes(query))
      : allBranches;
    // Sort: default branch first, then alphabetical
    return [...filtered].sort((a, b) => {
      if (a === defBranch) return -1;
      if (b === defBranch) return 1;
      return a.localeCompare(b);
    });
  };

  // Check for worktree conflict
  const checkWorktreeConflict = async (dir: string, branchName: string): Promise<WorktreeConflict | null> => {
    try {
      const worktrees = await listWorktrees(dir);
      const existing = worktrees.find(wt => wt.branch === branchName);
      if (existing && !existing.isMain) {
        return {
          branch: branchName,
          existingPath: existing.path,
        };
      }
    } catch {
      // Ignore errors (e.g., not a git repo)
    }
    return null;
  };

  const doCreateLane = async (laneName: string, laneWorkingDir: string, laneBranch: string | undefined) => {
    setIsCreating(true);
    setError(null);

    try {
      const lane = await createLane({
        name: laneName,
        workingDir: laneWorkingDir,
        branch: laneBranch,
      });

      // Reset form
      setName('');
      setWorkingDir('');
      setBranch('');
      setError(null);
      setShowBranchDropdown(false);
      setIsExistingBranch(false);

      // Close dialog and notify parent
      props.onOpenChange(false);
      props.onLaneCreated(lane);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreate = async () => {
    const laneName = name().trim();
    const laneWorkingDir = workingDir().trim();
    const laneBranch = branch().trim();

    // Validation
    if (!laneName) {
      setError('Lane name is required');
      return;
    }

    if (!laneWorkingDir) {
      setError('Working directory is required');
      return;
    }

    setError(null);

    // Check for worktree conflict if branch is specified
    if (laneBranch && isGitRepoDir()) {
      const conflict = await checkWorktreeConflict(laneWorkingDir, laneBranch);
      if (conflict) {
        setWorktreeConflict(conflict);
        return;
      }
    }

    await doCreateLane(laneName, laneWorkingDir, laneBranch || undefined);
  };

  const handleUseExistingWorktree = async () => {
    const conflict = worktreeConflict();
    if (!conflict) return;

    setWorktreeConflict(null);
    // Create lane - createLane will detect existing worktree and handle it
    await doCreateLane(name().trim(), workingDir().trim(), conflict.branch);
  };

  const handleRemoveAndCreate = async () => {
    const conflict = worktreeConflict();
    if (!conflict) return;

    setWorktreeConflict(null);
    setIsCreating(true);
    setError(null);

    try {
      // Remove existing worktree
      await removeWorktree(workingDir().trim(), conflict.existingPath);
      // Now create the lane (which will create a new worktree)
      await doCreateLane(name().trim(), workingDir().trim(), conflict.branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsCreating(false);
    }
  };

  const handleUseDifferentBranch = async (newBranch: string) => {
    setWorktreeConflict(null);
    setBranch(newBranch);

    // Check if new branch also has a conflict
    const conflict = await checkWorktreeConflict(workingDir().trim(), newBranch);
    if (conflict) {
      setWorktreeConflict(conflict);
      return;
    }

    // No conflict, proceed with creation
    await doCreateLane(name().trim(), workingDir().trim(), newBranch);
  };

  const handleCancel = () => {
    setName('');
    setWorkingDir('');
    setBranch('');
    setError(null);
    setWorktreeConflict(null);
    setShowBranchDropdown(false);
    setIsExistingBranch(false);
    props.onOpenChange(false);
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory',
      });

      if (selected && typeof selected === 'string') {
        setWorkingDir(selected);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
    }
  };

  return (
    <>
    <Dialog
      open={props.open && !worktreeConflict()}
      onOpenChange={props.onOpenChange}
      title="Create New Lane"
      description="Start a new task with a dedicated AI agent and terminal session."
    >
      <div class="space-y-4" onClick={(e) => {
        // Close branch dropdown when clicking outside it
        if (!(e.target as HTMLElement).closest('.relative')) {
          setShowBranchDropdown(false);
        }
      }}>
        <TextField
          label="Lane Name"
          placeholder={currentPlaceholder()}
          value={name()}
          onChange={setName}
          description="What are you working on? e.g., feature name, bug fix, or task"
        />

        <div>
          <label class="block text-sm font-medium text-zed-text-primary mb-2">
            Working Directory
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              class="flex-1 input"
              placeholder="/path/to/project"
              value={workingDir()}
              onInput={(e) => setWorkingDir(e.currentTarget.value)}
            />
            <Button
              variant="secondary"
              onClick={handleBrowse}
              disabled={isCreating()}
            >
              Browse...
            </Button>
          </div>
          <p class="text-xs text-zed-text-tertiary mt-1">
            Absolute path to your project directory
          </p>
        </div>

        <Show when={isGitRepoDir()}>
          <div class="p-3 rounded-lg bg-zed-accent-green/5 border border-zed-accent-green/20">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-4 h-4 text-zed-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm font-medium text-zed-accent-green">Git repository detected</span>
            </div>
            <div class="relative">
              <label class="block text-sm font-medium text-zed-text-primary mb-1.5">
                Branch
              </label>
              <input
                type="text"
                class="w-full input"
                placeholder="Type to search or create a branch..."
                value={branch()}
                onInput={(e) => {
                  setBranch(e.currentTarget.value);
                  setShowBranchDropdown(true);
                }}
                onFocus={() => setShowBranchDropdown(true)}
              />
              <Show when={isExistingBranch()}>
                <span class="absolute right-2 top-[calc(50%+10px)] -translate-y-1/2 text-xs text-zed-accent-green">
                  existing
                </span>
              </Show>
              <Show when={showBranchDropdown() && filteredBranches().length > 0}>
                <div
                  class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md bg-zed-bg-overlay border border-zed-border-default shadow-lg"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <For each={filteredBranches()}>
                    {(b) => (
                      <button
                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-zed-bg-hover transition-colors flex items-center justify-between"
                        classList={{ 'text-zed-text-primary': true, 'bg-zed-bg-hover': branch() === b }}
                        onClick={() => {
                          setBranch(b);
                          setShowBranchDropdown(false);
                        }}
                      >
                        <span class="truncate">{b}</span>
                        <Show when={b === defaultBranch()}>
                          <span class="text-xs text-zed-text-tertiary ml-2 shrink-0">default</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <p class="text-xs text-zed-text-tertiary mt-2 leading-relaxed">
              Select an existing branch or type a new name to create one from <strong>{defaultBranch()}</strong>.
              Each lane gets its own isolated worktree — no conflicts, no stashing.
              Leave empty to work on the current branch.
            </p>
          </div>
        </Show>

        <Show when={error()}>
          <div class="p-3 rounded-md bg-zed-accent-red/10 border border-zed-accent-red/30 text-sm text-zed-accent-red">
            {error()}
          </div>
        </Show>

        <div class="flex justify-end gap-2 mt-6">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isCreating()}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={isCreating()}
          >
            {isCreating() ? 'Creating...' : 'Create Lane'}
          </Button>
        </div>
      </div>
    </Dialog>

    {/* Worktree conflict dialog */}
    <Show when={worktreeConflict()}>
      {(conflict) => (
        <WorktreeConflictDialog
          open={true}
          branch={conflict().branch}
          existingPath={conflict().existingPath}
          onUseExisting={handleUseExistingWorktree}
          onRemoveAndCreate={handleRemoveAndCreate}
          onUseDifferentBranch={handleUseDifferentBranch}
          onCancel={() => setWorktreeConflict(null)}
        />
      )}
    </Show>
    </>
  );
}
