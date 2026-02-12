import type { WizardData } from '../OnboardingWizard';

interface NotificationsStepProps {
  data: WizardData;
  onDataChange: (updates: Partial<WizardData>) => void;
}

export function NotificationsStep(props: NotificationsStepProps) {
  const toggleNotification = (key: keyof WizardData['notifications']) => {
    props.onDataChange({
      notifications: {
        ...props.data.notifications,
        [key]: !props.data.notifications[key],
      },
    });
  };

  return (
    <div class="max-w-2xl mx-auto">
      <div class="mb-6">
        <p class="text-zed-text-secondary mb-4">
          Choose when you want to receive notifications from your AI agents.
        </p>
      </div>

      {/* Notification Options */}
      <div class="space-y-4 mb-6">
        {/* Task Complete */}
        <div class="flex items-center justify-between p-4 bg-zed-bg-hover rounded-lg">
          <div class="flex-1 flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <label class="font-medium text-zed-text-primary">
                When agent finishes task
              </label>
              <p class="text-sm text-zed-text-tertiary mt-0.5">
                Get notified when your agent completes its work
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleNotification('onTaskComplete')}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 ${
              props.data.notifications.onTaskComplete ? 'bg-zed-accent-blue' : 'bg-zed-bg-active'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                props.data.notifications.onTaskComplete ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Needs Input */}
        <div class="flex items-center justify-between p-4 bg-zed-bg-hover rounded-lg">
          <div class="flex-1 flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M8 10h.01" />
                <path d="M12 10h.01" />
                <path d="M16 10h.01" />
              </svg>
            </div>
            <div>
              <label class="font-medium text-zed-text-primary">
                When agent needs input
              </label>
              <p class="text-sm text-zed-text-tertiary mt-0.5">
                Get notified when your agent is waiting for your response
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleNotification('onNeedsInput')}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 ${
              props.data.notifications.onNeedsInput ? 'bg-zed-accent-blue' : 'bg-zed-bg-active'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                props.data.notifications.onNeedsInput ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Error */}
        <div class="flex items-center justify-between p-4 bg-zed-bg-hover rounded-lg">
          <div class="flex-1 flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div>
              <label class="font-medium text-zed-text-primary">
                When agent encounters error
              </label>
              <p class="text-sm text-zed-text-tertiary mt-0.5">
                Get notified when your agent runs into problems
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleNotification('onError')}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 ${
              props.data.notifications.onError ? 'bg-zed-accent-blue' : 'bg-zed-bg-active'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                props.data.notifications.onError ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Only When Unfocused */}
        <div class="flex items-center justify-between p-4 bg-zed-bg-hover rounded-lg border-2 border-zed-accent-blue/30">
          <div class="flex-1 flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                <line x1="8" x2="16" y1="2" y2="2" />
              </svg>
            </div>
            <div>
              <label class="font-medium text-zed-text-primary">
                Only when window is unfocused
              </label>
              <p class="text-sm text-zed-text-tertiary mt-0.5">
                Recommended: Don't disturb when you're actively using Codelane
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleNotification('onlyWhenUnfocused')}
            class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ml-4 ${
              props.data.notifications.onlyWhenUnfocused ? 'bg-zed-accent-blue' : 'bg-zed-bg-active'
            }`}
          >
            <span
              class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                props.data.notifications.onlyWhenUnfocused ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tutorial Content */}
      <div class="bg-zed-bg-hover p-4 rounded-lg">
        <h3 class="font-semibold text-zed-text-primary mb-2 flex items-center gap-2">
          <svg class="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          <span>When are notifications useful?</span>
        </h3>
        <ul class="text-sm text-zed-text-secondary space-y-2 pl-8">
          <li>• Working across multiple lanes simultaneously</li>
          <li>• Agent running in background while you focus elsewhere</li>
          <li>• Multitasking while agent works on refactoring</li>
          <li>• Running long-running tasks that need occasional input</li>
        </ul>
        <p class="text-sm text-zed-text-tertiary mt-3 pl-8">
          You can customize these settings anytime in Settings → Notifications
        </p>
      </div>
    </div>
  );
}
