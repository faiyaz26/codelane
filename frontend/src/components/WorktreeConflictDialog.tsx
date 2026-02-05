import { createSignal, Show } from 'solid-js';
import { Dialog, Button, TextField } from './ui';

interface WorktreeConflictDialogProps {
  open: boolean;
  branch: string;
  existingPath: string;
  onUseExisting: () => void;
  onRemoveAndCreate: () => void;
  onUseDifferentBranch: (newBranch: string) => void;
  onCancel: () => void;
}

export function WorktreeConflictDialog(props: WorktreeConflictDialogProps) {
  const [selectedOption, setSelectedOption] = createSignal<'existing' | 'remove' | 'different'>('existing');
  const [newBranchName, setNewBranchName] = createSignal('');
  const [isProcessing, setIsProcessing] = createSignal(false);

  const handleContinue = async () => {
    setIsProcessing(true);
    try {
      switch (selectedOption()) {
        case 'existing':
          props.onUseExisting();
          break;
        case 'remove':
          props.onRemoveAndCreate();
          break;
        case 'different':
          const branch = newBranchName().trim();
          if (branch) {
            props.onUseDifferentBranch(branch);
          }
          break;
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const canContinue = () => {
    if (selectedOption() === 'different') {
      return newBranchName().trim().length > 0;
    }
    return true;
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => !open && props.onCancel()}
      title="Branch Already in Use"
    >
      <div class="space-y-4">
        <p class="text-sm text-zed-text-secondary">
          Branch <span class="font-mono text-zed-accent-orange">"{props.branch}"</span> is already checked out in a worktree at:
        </p>

        <div class="p-3 bg-zed-bg-panel rounded border border-zed-border-subtle">
          <code class="text-xs text-zed-text-tertiary break-all">{props.existingPath}</code>
        </div>

        <p class="text-sm text-zed-text-secondary">What would you like to do?</p>

        <div class="space-y-3">
          {/* Option 1: Use existing */}
          <label class="flex items-start gap-3 p-3 rounded border border-zed-border-subtle hover:border-zed-border-default cursor-pointer transition-colors">
            <input
              type="radio"
              name="worktree-option"
              checked={selectedOption() === 'existing'}
              onChange={() => setSelectedOption('existing')}
              class="mt-1"
            />
            <div class="flex-1">
              <div class="text-sm font-medium text-zed-text-primary">Use existing worktree location</div>
              <div class="text-xs text-zed-text-tertiary mt-1">
                Lane will use the existing worktree path
              </div>
            </div>
          </label>

          {/* Option 2: Remove and create */}
          <label class="flex items-start gap-3 p-3 rounded border border-zed-border-subtle hover:border-zed-border-default cursor-pointer transition-colors">
            <input
              type="radio"
              name="worktree-option"
              checked={selectedOption() === 'remove'}
              onChange={() => setSelectedOption('remove')}
              class="mt-1"
            />
            <div class="flex-1">
              <div class="text-sm font-medium text-zed-text-primary">Remove existing & create new here</div>
              <div class="text-xs text-zed-accent-orange mt-1 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Deletes worktree at existing location
              </div>
            </div>
          </label>

          {/* Option 3: Different branch */}
          <label class="flex items-start gap-3 p-3 rounded border border-zed-border-subtle hover:border-zed-border-default cursor-pointer transition-colors">
            <input
              type="radio"
              name="worktree-option"
              checked={selectedOption() === 'different'}
              onChange={() => setSelectedOption('different')}
              class="mt-1"
            />
            <div class="flex-1">
              <div class="text-sm font-medium text-zed-text-primary">Use different branch name</div>
              <div class="text-xs text-zed-text-tertiary mt-1">
                Enter a new branch name to create a separate worktree
              </div>
            </div>
          </label>

          {/* Branch name input (shown when "different" is selected) */}
          <Show when={selectedOption() === 'different'}>
            <div class="pl-8">
              <TextField
                label=""
                placeholder="feature/new-branch"
                value={newBranchName()}
                onChange={setNewBranchName}
              />
            </div>
          </Show>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-zed-border-subtle">
          <Button
            variant="secondary"
            onClick={props.onCancel}
            disabled={isProcessing()}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleContinue}
            disabled={!canContinue() || isProcessing()}
          >
            {isProcessing() ? 'Processing...' : 'Continue'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
