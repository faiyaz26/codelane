import { createSignal, Show } from 'solid-js';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, Button, TextField } from './ui';
import { createLane } from '../lib/lane-api';
import type { Lane } from '../types/lane';

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
      });

      // Reset form
      setName('');
      setWorkingDir('');
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
      description="Set up a new project workspace with its own terminal and AI agents."
    >
      <div class="space-y-4">
        <TextField
          label="Lane Name"
          placeholder="My Project"
          value={name()}
          onChange={setName}
          description="A descriptive name for this project workspace"
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
