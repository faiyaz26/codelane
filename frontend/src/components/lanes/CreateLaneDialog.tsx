import { createSignal, Show, createEffect, onCleanup } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, Button, TextField } from '../ui';
import { createLane } from '../../lib/lane-api';
import { isGitRepo } from '../../lib/git-api';
import type { Lane } from '../../types/lane';

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
          setBranch(''); // Clear branch if not a git repo
        }
      } catch (e) {
        setIsGitRepoDir(false);
        setBranch('');
      } finally {
        setCheckingGitRepo(false);
      }
    } else {
      setIsGitRepoDir(false);
      setBranch('');
    }
  });

  const handleCreate = async () => {
    const laneName = name().trim();
    const laneWorkingDir = workingDir().trim();

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
    setIsCreating(true);

    try {
      const lane = await createLane({
        name: laneName,
        workingDir: laneWorkingDir,
        branch: branch().trim() || undefined,
      });

      // Reset form
      setName('');
      setWorkingDir('');
      setBranch('');
      setError(null);

      // Close dialog and notify parent
      props.onOpenChange(false);
      props.onLaneCreated(lane);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setWorkingDir('');
    setBranch('');
    setError(null);
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
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Create New Lane"
      description="Start a new task with a dedicated AI agent and terminal session."
    >
      <div class="space-y-4">
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
            <TextField
              label="Feature Branch (Optional)"
              placeholder="feature/add-auth"
              value={branch()}
              onChange={setBranch}
              description=""
            />
            <p class="text-xs text-zed-text-tertiary mt-2 leading-relaxed">
              Run multiple AI agents in parallel on different branches. Each lane gets its own isolated worktree —
              no conflicts, no stashing. Leave empty to work on the current branch.
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
  );
}
