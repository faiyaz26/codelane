// Notification Settings Tab

import { createSignal } from 'solid-js';
import { agentStatusManager } from '../../services/AgentStatusManager';
import type { AgentNotificationSettings } from '../../types/agentStatus';

export function NotificationSettings() {
  const initial = agentStatusManager.getNotificationSettings();
  const [notifyOnDone, setNotifyOnDone] = createSignal(initial.notifyOnDone);
  const [notifyOnWaitingForInput, setNotifyOnWaitingForInput] = createSignal(initial.notifyOnWaitingForInput);
  const [notifyOnError, setNotifyOnError] = createSignal(initial.notifyOnError);
  const [onlyWhenUnfocused, setOnlyWhenUnfocused] = createSignal(initial.onlyWhenUnfocused);
  const [promptDismissed, setPromptDismissed] = createSignal(
    !agentStatusManager.shouldShowNotificationPrompt()
  );

  const handleToggle = (field: keyof AgentNotificationSettings) => {
    let newValue: boolean;
    switch (field) {
      case 'notifyOnDone':
        newValue = !notifyOnDone();
        setNotifyOnDone(newValue);
        break;
      case 'notifyOnWaitingForInput':
        newValue = !notifyOnWaitingForInput();
        setNotifyOnWaitingForInput(newValue);
        break;
      case 'notifyOnError':
        newValue = !notifyOnError();
        setNotifyOnError(newValue);
        break;
      case 'onlyWhenUnfocused':
        newValue = !onlyWhenUnfocused();
        setOnlyWhenUnfocused(newValue);
        break;
      default:
        return;
    }
    agentStatusManager.updateNotificationSettings({ [field]: newValue });
  };

  return (
    <div>
      <h2 class="text-xl font-semibold text-zed-text-primary mb-2">Notification Settings</h2>
      <p class="text-sm text-zed-text-secondary mb-6">
        Configure when you receive notifications about agent activity.
      </p>

      <div class="space-y-6">
        {/* Agent Notifications */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">Agent Notifications</h3>

          <div class="space-y-3">
            {/* Notify when agent finishes */}
            <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-zed-text-primary">Notify when agent finishes</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Show a notification when an agent completes its task
                  </p>
                </div>
                <button
                  class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyOnDone() ? 'bg-zed-accent-blue' : 'bg-zed-bg-hover'
                  }`}
                  onClick={() => handleToggle('notifyOnDone')}
                >
                  <span class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    notifyOnDone() ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* Notify when agent needs input */}
            <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-zed-text-primary">Notify when agent needs input</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Show a notification when an agent is waiting for your response
                  </p>
                </div>
                <button
                  class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyOnWaitingForInput() ? 'bg-zed-accent-blue' : 'bg-zed-bg-hover'
                  }`}
                  onClick={() => handleToggle('notifyOnWaitingForInput')}
                >
                  <span class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    notifyOnWaitingForInput() ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* Notify on agent errors */}
            <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-zed-text-primary">Notify on agent errors</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Show a notification when an agent encounters an error
                  </p>
                </div>
                <button
                  class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    notifyOnError() ? 'bg-zed-accent-blue' : 'bg-zed-bg-hover'
                  }`}
                  onClick={() => handleToggle('notifyOnError')}
                >
                  <span class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    notifyOnError() ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div>
          <h3 class="text-sm font-medium text-zed-text-primary mb-4">Behavior</h3>

          <div class="space-y-3">
            {/* Only when unfocused */}
            <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-zed-text-primary">Only notify when window is unfocused</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Suppress notifications while the Codelane window is in the foreground
                  </p>
                </div>
                <button
                  class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    onlyWhenUnfocused() ? 'bg-zed-accent-blue' : 'bg-zed-bg-hover'
                  }`}
                  onClick={() => handleToggle('onlyWhenUnfocused')}
                >
                  <span class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    onlyWhenUnfocused() ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* Hide notification prompt */}
            <div class="p-4 rounded-lg bg-zed-bg-surface border border-zed-border-default">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-zed-text-primary">Hide notification prompt in terminal</p>
                  <p class="text-xs text-zed-text-tertiary mt-1">
                    Don't show the notification setup prompt when an agent starts working
                  </p>
                </div>
                <button
                  class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    promptDismissed() ? 'bg-zed-accent-blue' : 'bg-zed-bg-hover'
                  }`}
                  onClick={() => {
                    if (promptDismissed()) {
                      // Re-enable: remove the dismissed flag
                      localStorage.removeItem('codelane:notification-prompt-dismissed');
                      setPromptDismissed(false);
                    } else {
                      agentStatusManager.dismissNotificationPrompt();
                      setPromptDismissed(true);
                    }
                  }}
                >
                  <span class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    promptDismissed() ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
