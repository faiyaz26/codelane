import { createSignal, Show, For, createEffect, onCleanup } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, Button, TextField } from '../ui';
import { createLane } from '../../lib/lane-api';
import { isGitRepo, listWorktrees, removeWorktree, getGitBranch, getDefaultBranch } from '../../lib/git-api';
import { checkGhStatus, fetchPrInfo } from '../../lib/github-api';
import { WorktreeConflictDialog } from '../WorktreeConflictDialog';
import type { Lane, LaneType, PrMetadata } from '../../types/lane';
import type { GitBranchInfo } from '../../types/git';
import type { GhCliStatus } from '../../lib/github-api';

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
  // Shared state
  const [laneType, setLaneType] = createSignal<LaneType>('feature');
  const [name, setName] = createSignal('');
  const [workingDir, setWorkingDir] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);

  // Feature lane state
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

  // PR review lane state
  const [prUrl, setPrUrl] = createSignal('');
  const [ghStatus, setGhStatus] = createSignal<GhCliStatus | null>(null);
  const [checkingGh, setCheckingGh] = createSignal(false);
  const [fetchingPr, setFetchingPr] = createSignal(false);
  const [prMetadata, setPrMetadata] = createSignal<PrMetadata | null>(null);
  const [prError, setPrError] = createSignal<string | null>(null);

  // Check gh CLI status when switching to PR mode
  createEffect(() => {
    if (props.open && laneType() === 'pr_review' && !ghStatus()) {
      setCheckingGh(true);
      checkGhStatus()
        .then((status) => setGhStatus(status))
        .catch(() => setGhStatus({ installed: false, authenticated: false, user: null, version: null }))
        .finally(() => setCheckingGh(false));
    }
  });

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

  // Check if working directory is a git repo when it changes (feature mode)
  createEffect(async () => {
    const dir = workingDir();
    if (dir && dir.trim() && laneType() === 'feature') {
      setCheckingGitRepo(true);
      try {
        const result = await isGitRepo(dir);
        setIsGitRepoDir(result);
        if (!result) {
          setBranch('');
          setBranches([]);
          setIsExistingBranch(false);
        } else {
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
    } else if (laneType() === 'feature') {
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
    return [...filtered].sort((a, b) => {
      if (a === defBranch) return -1;
      if (b === defBranch) return 1;
      return a.localeCompare(b);
    });
  };

  const ghReady = () => {
    const s = ghStatus();
    return s?.installed && s?.authenticated;
  };

  // Fetch PR info
  const handleFetchPr = async () => {
    const url = prUrl().trim();
    if (!url) {
      setPrError('Please enter a PR URL');
      return;
    }

    // Basic URL validation
    if (!url.match(/github\.com\/.+\/.+\/pull\/\d+/)) {
      setPrError('Invalid PR URL. Expected format: https://github.com/owner/repo/pull/123');
      return;
    }

    setFetchingPr(true);
    setPrError(null);
    setPrMetadata(null);

    try {
      const info = await fetchPrInfo(url);
      setPrMetadata(info);
      // Auto-fill lane name from PR title
      if (!name().trim()) {
        setName(`PR #${info.number}: ${info.title}`);
      }
    } catch (err) {
      setPrError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingPr(false);
    }
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
      // Ignore errors
    }
    return null;
  };

  const doCreateLane = async (
    laneName: string,
    laneWorkingDir: string,
    laneBranch: string | undefined,
    type?: LaneType,
    metadata?: PrMetadata,
  ) => {
    setIsCreating(true);
    setError(null);

    try {
      const lane = await createLane({
        name: laneName,
        workingDir: laneWorkingDir,
        branch: laneBranch,
        laneType: type,
        prMetadata: metadata,
      });

      // Reset form
      resetForm();

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
    if (laneType() === 'pr_review') {
      return handleCreatePrLane();
    }
    return handleCreateFeatureLane();
  };

  const handleCreateFeatureLane = async () => {
    const laneName = name().trim();
    const laneWorkingDir = workingDir().trim();
    const laneBranch = branch().trim();

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

  const handleCreatePrLane = async () => {
    const laneName = name().trim();
    const laneWorkingDir = workingDir().trim();
    const metadata = prMetadata();

    if (!laneName) {
      setError('Lane name is required');
      return;
    }
    if (!laneWorkingDir) {
      setError('Working directory is required');
      return;
    }
    if (!metadata) {
      setError('Please fetch the PR first');
      return;
    }

    setError(null);

    // Use the PR head branch for the worktree
    const prBranch = metadata.headBranch;

    // Check for worktree conflict
    const conflict = await checkWorktreeConflict(laneWorkingDir, prBranch);
    if (conflict) {
      setWorktreeConflict(conflict);
      return;
    }

    await doCreateLane(laneName, laneWorkingDir, prBranch, 'pr_review', metadata);
  };

  const handleUseExistingWorktree = async () => {
    const conflict = worktreeConflict();
    if (!conflict) return;

    setWorktreeConflict(null);

    if (laneType() === 'pr_review') {
      const metadata = prMetadata();
      await doCreateLane(name().trim(), workingDir().trim(), conflict.branch, 'pr_review', metadata || undefined);
    } else {
      await doCreateLane(name().trim(), workingDir().trim(), conflict.branch);
    }
  };

  const handleRemoveAndCreate = async () => {
    const conflict = worktreeConflict();
    if (!conflict) return;

    setWorktreeConflict(null);
    setIsCreating(true);
    setError(null);

    try {
      await removeWorktree(workingDir().trim(), conflict.existingPath);
      if (laneType() === 'pr_review') {
        const metadata = prMetadata();
        await doCreateLane(name().trim(), workingDir().trim(), conflict.branch, 'pr_review', metadata || undefined);
      } else {
        await doCreateLane(name().trim(), workingDir().trim(), conflict.branch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsCreating(false);
    }
  };

  const handleUseDifferentBranch = async (newBranch: string) => {
    setWorktreeConflict(null);
    setBranch(newBranch);

    const conflict = await checkWorktreeConflict(workingDir().trim(), newBranch);
    if (conflict) {
      setWorktreeConflict(conflict);
      return;
    }

    await doCreateLane(name().trim(), workingDir().trim(), newBranch);
  };

  const resetForm = () => {
    setName('');
    setWorkingDir('');
    setBranch('');
    setError(null);
    setWorktreeConflict(null);
    setShowBranchDropdown(false);
    setIsExistingBranch(false);
    setPrUrl('');
    setPrMetadata(null);
    setPrError(null);
  };

  const handleCancel = () => {
    resetForm();
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
      description={laneType() === 'pr_review'
        ? 'Review a GitHub Pull Request with AI-powered code review.'
        : 'Start a new task with a dedicated AI agent and terminal session.'}
    >
      <div class="space-y-4" onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.relative')) {
          setShowBranchDropdown(false);
        }
      }}>
        {/* Lane type toggle */}
        <div class="flex rounded-lg bg-zed-bg-surface border border-zed-border-subtle p-0.5">
          <button
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            classList={{
              'bg-zed-bg-hover text-zed-text-primary shadow-sm': laneType() === 'feature',
              'text-zed-text-tertiary hover:text-zed-text-secondary': laneType() !== 'feature',
            }}
            onClick={() => setLaneType('feature')}
          >
            Feature
          </button>
          <button
            class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            classList={{
              'bg-zed-bg-hover text-zed-text-primary shadow-sm': laneType() === 'pr_review',
              'text-zed-text-tertiary hover:text-zed-text-secondary': laneType() !== 'pr_review',
            }}
            onClick={() => setLaneType('pr_review')}
          >
            PR Review
          </button>
        </div>

        {/* PR Review mode */}
        <Show when={laneType() === 'pr_review'}>
          {/* gh CLI status */}
          <Show when={checkingGh()}>
            <div class="p-3 rounded-lg bg-zed-bg-surface border border-zed-border-subtle">
              <span class="text-xs text-zed-text-tertiary">Checking GitHub CLI...</span>
            </div>
          </Show>

          <Show when={!checkingGh() && ghStatus() && !ghReady()}>
            <div class="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span class="text-sm font-medium text-amber-400">GitHub CLI Required</span>
              </div>
              <Show when={!ghStatus()?.installed}>
                <p class="text-xs text-zed-text-secondary leading-relaxed">
                  The <code class="px-1 py-0.5 bg-zed-bg-hover rounded text-zed-text-primary">gh</code> CLI is not installed.
                  Install it from <a href="https://cli.github.com" class="text-purple-400 hover:underline" target="_blank">cli.github.com</a>.
                </p>
              </Show>
              <Show when={ghStatus()?.installed && !ghStatus()?.authenticated}>
                <p class="text-xs text-zed-text-secondary leading-relaxed">
                  The <code class="px-1 py-0.5 bg-zed-bg-hover rounded text-zed-text-primary">gh</code> CLI is installed but not authenticated.
                  Run <code class="px-1 py-0.5 bg-zed-bg-hover rounded text-zed-text-primary">gh auth login</code> to authenticate.
                </p>
              </Show>
            </div>
          </Show>

          <Show when={ghReady()}>
            <div class="flex items-center gap-2 text-xs text-zed-text-tertiary">
              <svg class="w-3.5 h-3.5 text-zed-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Signed in as <strong class="text-zed-text-secondary">{ghStatus()?.user}</strong></span>
            </div>

            {/* PR URL input */}
            <div>
              <label class="block text-sm font-medium text-zed-text-primary mb-1.5">
                Pull Request URL
              </label>
              <div class="flex gap-2">
                <input
                  type="text"
                  class="flex-1 input"
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={prUrl()}
                  onInput={(e) => {
                    setPrUrl(e.currentTarget.value);
                    setPrError(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFetchPr(); }}
                  disabled={fetchingPr()}
                />
                <Button
                  variant="secondary"
                  onClick={handleFetchPr}
                  disabled={fetchingPr() || !prUrl().trim()}
                >
                  {fetchingPr() ? 'Fetching...' : 'Fetch'}
                </Button>
              </div>
              <Show when={prError()}>
                <p class="text-xs text-zed-accent-red mt-1">{prError()}</p>
              </Show>
            </div>

            {/* PR preview card */}
            <Show when={prMetadata()}>
              {(meta) => (
                <div class="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
                  <div class="flex items-start gap-2">
                    <svg class="w-4 h-4 text-purple-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-zed-text-primary truncate">
                        #{meta().number} {meta().title}
                      </p>
                      <p class="text-xs text-zed-text-tertiary mt-0.5">
                        by {meta().author} &middot; {meta().repoName}
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-3 text-xs text-zed-text-tertiary">
                    <span>{meta().baseBranch} &larr; {meta().headBranch}</span>
                    <span class="text-zed-accent-green">+{meta().additions}</span>
                    <span class="text-zed-accent-red">-{meta().deletions}</span>
                    <span>{meta().filesChanged} files</span>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </Show>

        {/* Lane name - shown for both modes */}
        <TextField
          label="Lane Name"
          placeholder={laneType() === 'pr_review' ? 'Auto-filled from PR title' : currentPlaceholder()}
          value={name()}
          onChange={setName}
          description={laneType() === 'pr_review'
            ? 'Name for this review lane (auto-filled from PR)'
            : 'What are you working on? e.g., feature name, bug fix, or task'}
        />

        {/* Working directory - shown for both modes */}
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
            {laneType() === 'pr_review'
              ? 'Local path to the repository (must be a git repo)'
              : 'Absolute path to your project directory'}
          </p>
        </div>

        {/* Git branch section - feature mode only */}
        <Show when={laneType() === 'feature' && isGitRepoDir()}>
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
            disabled={isCreating() || (laneType() === 'pr_review' && !ghReady())}
          >
            {isCreating()
              ? 'Creating...'
              : laneType() === 'pr_review'
                ? 'Create Review Lane'
                : 'Create Lane'}
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
