import { createSignal, Show } from 'solid-js';
import { Dialog } from '../ui/Dialog';

export type TutorialTopic = 'quick-start' | 'lanes' | 'worktrees' | 'shortcuts';

interface TutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic?: TutorialTopic;
}

export function TutorialDialog(props: TutorialDialogProps) {
  const [currentStep, setCurrentStep] = createSignal(1);
  const [topic, setTopic] = createSignal<TutorialTopic | null>(props.topic || null);

  const getTutorialContent = () => {
    switch (topic()) {
      case 'quick-start':
        return {
          title: 'Quick Start Guide',
          totalSteps: 3,
          steps: [
            {
              title: 'Create Your First Lane',
              content: `Lanes are the core concept in Codelane. Each lane is an isolated development environment for a specific feature or task.

**To create a lane:**
1. Click the "+" button in the sidebar (or press ⌘/Ctrl+N)
2. Enter a lane name (e.g., "login-feature")
3. Choose a directory for your project
4. Click "Create Lane"

💡 **Tip:** You can have multiple lanes for the same project, each working on a different feature branch.`,
            },
            {
              title: 'Using the Terminal',
              content: `Each lane has its own terminal where your AI agent runs.

**The terminal shows:**
- **Yellow dot:** Agent is working
- **Orange dot:** Agent needs your input
- **Green dot:** Agent finished its task

Try it: Create a lane and run a command to see the status indicators in action!`,
            },
            {
              title: 'Understanding Status Indicators',
              content: `Codelane keeps you informed with real-time status indicators:

**Status Colors:**
- 🟢 **Green:** Idle or completed
- 🟡 **Yellow:** Working/processing
- 🟠 **Orange:** Needs input
- 🔴 **Red:** Error occurred

**Where you'll see them:**
- Lane tabs in the sidebar
- Terminal header
- System notifications (when enabled)

These indicators help you manage multiple lanes efficiently without constantly switching between them.`,
            },
          ],
        };
      case 'lanes':
        return {
          title: 'Working with Lanes',
          totalSteps: 2,
          steps: [
            {
              title: 'What Are Lanes?',
              content: `Think of lanes as separate "workspaces" for different tasks.

**Traditional workflow:**
- Switch branches → lose context
- Stash changes → risk conflicts
- One task at a time → slow progress

**With lanes:**
✓ Multiple tasks in parallel
✓ Each has own terminal
✓ Each has own file tree
✓ Instant switching

Lanes are powered by Git worktrees, which create separate working directories for each branch without the overhead of multiple repositories.`,
            },
            {
              title: 'Creating Effective Lanes',
              content: `**Best practices for lane organization:**

✓ **One feature per lane** - Keep lanes focused on a single task
✓ **Descriptive names** - Use names like "auth-refactor", "dark-mode"
✓ **Use git worktrees** - For isolated commits and branch management
✗ **Don't create lanes for quick fixes** - Use main lane instead
✗ **Don't reuse lanes** - Create new lanes for unrelated tasks

**Keyboard shortcuts:**
- ⌘/Ctrl+N - New lane
- ⌘/Ctrl+W - Close lane
- ⌘/Ctrl+[1-9] - Switch to lane 1-9`,
            },
          ],
        };
      case 'worktrees':
        return {
          title: 'Git Worktrees Explained',
          totalSteps: 2,
          steps: [
            {
              title: 'What Are Git Worktrees?',
              content: `Git worktrees let you have multiple working directories from the same repository.

**Without worktrees:**
You must commit or stash your changes before switching branches, which interrupts your workflow.

**With worktrees:**
Each lane has its own working directory, so you can work on multiple branches simultaneously without any conflicts.

**Benefits:**
- No context switching overhead
- No need to stash changes
- Work on multiple features in parallel
- Faster than cloning the repo multiple times`,
            },
            {
              title: 'How Codelane Uses Worktrees',
              content: `Codelane automatically manages worktrees for you:

**When you create a lane:**
1. Codelane creates a new git worktree
2. Associates it with a branch (new or existing)
3. Sets up the terminal in that worktree directory

**When you delete a lane:**
1. Codelane removes the worktree
2. Preserves your commits (they stay in git history)
3. Cleans up the working directory

💡 **Tip:** You can still use normal git commands in each lane's terminal. Each lane is a fully functional git working directory.`,
            },
          ],
        };
      case 'shortcuts':
        return {
          title: 'Keyboard Shortcuts',
          totalSteps: 1,
          steps: [
            {
              title: 'Master Keyboard Shortcuts',
              content: `Speed up your workflow with these shortcuts:

**Navigation:**
- ⌘/Ctrl+N - New Lane
- ⌘/Ctrl+W - Close Lane
- ⌘/Ctrl+[1-9] - Switch to Lane 1-9
- ⌘/Ctrl+Tab - Next Lane
- ⌘/Ctrl+Shift+Tab - Previous Lane

**Terminal:**
- ⌘/Ctrl+K - Clear Terminal
- ⌘/Ctrl+C - Interrupt Process

**Settings:**
- ⌘/Ctrl+, - Open Settings
- ⌘/Ctrl+/ - Open Tutorials

💡 **Tip:** You can customize keyboard shortcuts in Settings → Keybindings`,
            },
          ],
        };
      default:
        return {
          title: 'Tutorials',
          totalSteps: 1,
          steps: [
            {
              title: 'Select a Tutorial',
              content: 'Choose a tutorial from the list to get started.',
            },
          ],
        };
    }
  };

  const tutorial = () => getTutorialContent();
  const currentStepData = () => tutorial().steps[currentStep() - 1];

  const goNext = () => {
    if (currentStep() < tutorial().totalSteps) {
      setCurrentStep(currentStep() + 1);
    } else {
      // Mark as complete
      localStorage.setItem(`codelane:tutorial-${topic()}`, 'completed');
      props.onOpenChange(false);
    }
  };

  const goBack = () => {
    if (currentStep() > 1) {
      setCurrentStep(currentStep() - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} modal onOpenChange={props.onOpenChange}>
      <div class="w-[700px] max-h-[80vh] flex flex-col bg-zed-bg-app rounded-lg shadow-2xl">
        {/* Header */}
        <div class="border-b border-zed-border-default p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-semibold text-zed-text-primary">{tutorial().title}</h2>
            <button
              onClick={handleClose}
              class="text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-sm text-zed-text-tertiary">
              Step {currentStep()} of {tutorial().totalSteps}
            </div>
            {/* Progress bar */}
            <div class="h-1 w-48 bg-zed-bg-hover rounded-full">
              <div
                class="h-full bg-zed-accent-blue rounded-full transition-all duration-300"
                style={{ width: `${(currentStep() / tutorial().totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-6">
          <h3 class="text-xl font-semibold text-zed-text-primary mb-4">
            {currentStepData().title}
          </h3>
          <div class="prose prose-invert max-w-none">
            <div class="text-zed-text-secondary whitespace-pre-line leading-relaxed">
              {currentStepData().content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="border-t border-zed-border-default p-6 flex justify-between items-center">
          <button
            onClick={handleClose}
            class="text-sm text-zed-text-tertiary hover:text-zed-text-secondary transition-colors"
          >
            Skip Tutorial
          </button>
          <div class="flex gap-2">
            <Show when={currentStep() > 1}>
              <button
                onClick={goBack}
                class="px-4 py-2 rounded-md bg-zed-bg-hover hover:bg-zed-bg-active text-zed-text-primary transition-colors"
              >
                Back
              </button>
            </Show>
            <button
              onClick={goNext}
              class="px-4 py-2 rounded-md bg-zed-accent-blue hover:bg-blue-600 text-white transition-colors"
            >
              {currentStep() === tutorial().totalSteps ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
