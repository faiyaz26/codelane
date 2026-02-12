import type { WizardData } from '../OnboardingWizard';

interface TutorialsMenuStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  icon: string;
}

const TUTORIALS: Tutorial[] = [
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    description: 'Learn the basics: creating lanes, running agents, and understanding status indicators',
    duration: '5 min',
    icon: '🚀',
  },
  {
    id: 'lanes',
    title: 'Working with Lanes',
    description: 'Deep dive into lanes: what they are, how to manage them, and best practices',
    duration: '3 min',
    icon: '🛣️',
  },
  {
    id: 'worktrees',
    title: 'Git Worktrees Explained',
    description: 'Understand how Codelane uses git worktrees for parallel development',
    duration: '4 min',
    icon: '🔀',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Master keyboard shortcuts for faster navigation and productivity',
    duration: '2 min',
    icon: '⌨️',
  },
];

export function TutorialsMenuStep(props: TutorialsMenuStepProps) {
  const toggleTutorial = (tutorialId: string) => {
    const selected = props.data.selectedTutorials;
    if (selected.includes(tutorialId)) {
      props.onDataChange({
        selectedTutorials: selected.filter((id) => id !== tutorialId),
      });
    } else {
      props.onDataChange({
        selectedTutorials: [...selected, tutorialId],
      });
    }
  };

  const isSelected = (tutorialId: string) => {
    return props.data.selectedTutorials.includes(tutorialId);
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Choose tutorials to explore (optional). You can access these anytime from the Help menu.
        </p>
      </div>

      {/* Tutorial List */}
      <div class="space-y-3 mb-6">
        {TUTORIALS.map((tutorial) => (
          <button
            class={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-4 ${
              isSelected(tutorial.id)
                ? 'border-zed-accent-blue bg-zed-accent-blue/10'
                : 'border-zed-border-default hover:border-zed-border-focus bg-zed-bg-surface'
            }`}
            onClick={() => toggleTutorial(tutorial.id)}
          >
            {/* Checkbox */}
            <div class="flex-shrink-0 mt-1">
              <div
                class={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected(tutorial.id)
                    ? 'border-zed-accent-blue bg-zed-accent-blue'
                    : 'border-zed-border-default'
                }`}
              >
                {isSelected(tutorial.id) && (
                  <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* Content */}
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xl">{tutorial.icon}</span>
                <h3 class="text-base font-semibold text-zed-text-primary">{tutorial.title}</h3>
                <span class="text-xs text-zed-text-tertiary bg-zed-bg-hover px-2 py-0.5 rounded">
                  {tutorial.duration}
                </span>
              </div>
              <p class="text-sm text-zed-text-secondary">{tutorial.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Info */}
      <div class="bg-zed-bg-hover p-4 rounded-lg">
        <p class="text-sm text-zed-text-secondary">
          <span class="font-semibold text-zed-text-primary">💡 Tip:</span>{' '}
          You can skip tutorials now and access them anytime from{' '}
          <span class="text-zed-text-primary">Help → Tutorials</span> in the menu bar.
        </p>
      </div>
    </div>
  );
}
