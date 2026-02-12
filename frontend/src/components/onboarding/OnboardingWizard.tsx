import { createSignal, Show } from 'solid-js';
import { Dialog as KobalteDialog } from '@kobalte/core/dialog';
import { WelcomeStep } from './steps/WelcomeStep';
import { AgentSetupStep } from './steps/AgentSetupStep';
import { HookIntegrationStep } from './steps/HookIntegrationStep';
import { NotificationsStep } from './steps/NotificationsStep';
import { ThemeSelectionStep } from './steps/ThemeSelectionStep';
import { CompleteStep } from './steps/CompleteStep';
import type { AgentConfig } from '../../types/agent';

export type WizardStep = 'welcome' | 'agent' | 'hooks' | 'notifications' | 'theme' | 'tutorials' | 'complete';

export interface WizardData {
  agent: AgentConfig | null;
  hooksEnabled: boolean;
  notifications: {
    onTaskComplete: boolean;
    onNeedsInput: boolean;
    onError: boolean;
    onlyWhenUnfocused: boolean;
  };
  theme: string;
  selectedTutorials: string[];
}

interface OnboardingWizardProps {
  open: boolean;
  onComplete: (data: WizardData) => void;
  onSkip: () => void;
}

export function OnboardingWizard(props: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = createSignal<WizardStep>('welcome');
  const [wizardData, setWizardData] = createSignal<WizardData>({
    agent: null,
    hooksEnabled: false,
    notifications: {
      onTaskComplete: true,
      onNeedsInput: true,
      onError: true,
      onlyWhenUnfocused: true,
    },
    theme: 'dark',
    selectedTutorials: [],
  });

  const steps: WizardStep[] = ['welcome', 'agent', 'hooks', 'notifications', 'theme', 'complete'];

  const getStepTitle = (step: WizardStep): string => {
    const titles: Record<WizardStep, string> = {
      welcome: 'Welcome to Codelane',
      agent: 'Choose Your AI Agent',
      hooks: 'Enable Instant Notifications',
      notifications: 'Notification Preferences',
      theme: 'Choose Your Theme',
      tutorials: 'Learn Codelane',
      complete: "You're All Set!",
    };
    return titles[step];
  };

  const getCurrentStepNumber = (): number => {
    return steps.indexOf(currentStep()) + 1;
  };

  const getTotalSteps = (): number => {
    return steps.length;
  };

  const agentSupportsHooks = (): boolean => {
    const agent = wizardData().agent;
    if (!agent) return false;
    // Claude, Codex, and Gemini support hooks
    const supportsHooks = ['claude', 'codex', 'gemini'];
    return supportsHooks.includes(agent.agentType.toLowerCase());
  };

  const goNext = () => {
    const current = currentStep();
    const index = steps.indexOf(current);
    if (index < steps.length - 1) {
      // Skip hooks step if agent doesn't support it
      if (steps[index + 1] === 'hooks' && !agentSupportsHooks()) {
        setCurrentStep(steps[index + 2]);
      } else {
        setCurrentStep(steps[index + 1]);
      }
    } else if (current === 'complete') {
      // Finish wizard
      props.onComplete(wizardData());
    }
  };

  const goBack = () => {
    const current = currentStep();
    const index = steps.indexOf(current);
    if (index > 0) {
      // Skip hooks step if agent doesn't support it (going backwards)
      if (steps[index - 1] === 'hooks' && !agentSupportsHooks()) {
        setCurrentStep(steps[index - 2]);
      } else {
        setCurrentStep(steps[index - 1]);
      }
    }
  };

  const updateData = (updates: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  };

  const canContinue = (): boolean => {
    const step = currentStep();
    switch (step) {
      case 'agent':
        return wizardData().agent !== null;
      default:
        return true;
    }
  };

  const getButtonText = (): string => {
    const step = currentStep();
    if (step === 'complete') return 'Get Started';
    if (step === 'tutorials') return 'Continue';
    return 'Continue';
  };

  return (
    <KobalteDialog open={props.open} modal>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content class="w-[800px] max-h-[85vh] flex flex-col bg-zed-bg-app rounded-lg shadow-2xl border border-zed-border-default">
            {/* Header with step indicator */}
            <div class="border-b border-zed-border-default px-6 py-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-xl font-semibold text-zed-text-primary">{getStepTitle(currentStep())}</h2>
                <div class="text-sm text-zed-text-tertiary">
                  Step {getCurrentStepNumber()} of {getTotalSteps()}
                </div>
              </div>
              {/* Progress bar */}
              <div class="h-1 bg-zed-bg-hover rounded-full">
                <div
                  class="h-full bg-zed-accent-blue rounded-full transition-all duration-300"
                  style={{ width: `${(getCurrentStepNumber() / getTotalSteps()) * 100}%` }}
                />
              </div>
            </div>

            {/* Content area (scrollable) */}
            <div class="flex-1 overflow-y-auto px-6 py-5">
              <Show when={currentStep() === 'welcome'}>
                <WelcomeStep />
              </Show>
              <Show when={currentStep() === 'agent'}>
                <AgentSetupStep data={wizardData()} onDataChange={updateData} />
              </Show>
              <Show when={currentStep() === 'hooks'}>
                <HookIntegrationStep data={wizardData()} onDataChange={updateData} />
              </Show>
              <Show when={currentStep() === 'notifications'}>
                <NotificationsStep data={wizardData()} onDataChange={updateData} />
              </Show>
              <Show when={currentStep() === 'theme'}>
                <ThemeSelectionStep data={wizardData()} onDataChange={updateData} />
              </Show>
              <Show when={currentStep() === 'complete'}>
                <CompleteStep data={wizardData()} />
              </Show>
            </div>

            {/* Footer with navigation */}
            <div class="border-t border-zed-border-default px-6 py-4 flex justify-between items-center">
              <button
                onClick={props.onSkip}
                class="text-sm text-zed-text-tertiary hover:text-zed-text-secondary transition-colors"
              >
                Skip Setup
              </button>
              <div class="flex gap-2">
                <Show when={currentStep() !== 'welcome'}>
                  <button
                    onClick={goBack}
                    class="px-4 py-2 rounded-md bg-zed-bg-hover hover:bg-zed-bg-active text-zed-text-primary transition-colors"
                  >
                    Back
                  </button>
                </Show>
                <button
                  onClick={goNext}
                  disabled={!canContinue()}
                  class="px-4 py-2 rounded-md bg-zed-accent-blue hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {getButtonText()}
                </button>
              </div>
            </div>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
