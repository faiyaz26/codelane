import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { agentStatusManager } from '../services/AgentStatusManager';
import type { Lane } from '../types/lane';

interface GlobalNotificationsProps {
  lanes: Lane[];
  activeLaneId: string | null;
  onLaneSelect: (laneId: string) => void;
  onSettingsOpen: () => void;
}

export function GlobalNotifications(props: GlobalNotificationsProps) {
  const [notification, setNotification] = createSignal<{ 
    message: string; 
    type: 'error' | 'warning' | 'info';
    onClick?: () => void;
  } | null>(null);

  onMount(() => {
    const unsubscribe = agentStatusManager.onStatusChange((change) => {
      // Don't show in-app notification if we are already in this lane
      if (change.laneId === props.activeLaneId) return;

      const settings = agentStatusManager.getNotificationSettings();
      
      let message: string | null = null;
      let type: 'info' | 'warning' | 'error' = 'info';

      if (change.newStatus === 'done' && settings.notifyOnDone) {
        const laneName = props.lanes.find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent finished task in "${laneName}". Click to switch.`;
        type = 'info';
      } else if (change.newStatus === 'waiting_for_input' && settings.notifyOnWaitingForInput) {
        const laneName = props.lanes.find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent needs input in "${laneName}". Click to switch.`;
        type = 'warning';
      } else if (change.newStatus === 'error' && settings.notifyOnError) {
        const laneName = props.lanes.find(l => l.id === change.laneId)?.name || 'lane';
        message = `Agent error in "${laneName}". Click to switch.`;
        type = 'error';
      }

      if (message) {
        setNotification({
          message,
          type,
          onClick: () => {
            props.onLaneSelect(change.laneId);
            setNotification(null);
          }
        });

        // Auto-dismiss after 10 seconds
        const currentMessage = message;
        setTimeout(() => {
          setNotification((prev) => prev?.message === currentMessage ? null : prev);
        }, 10000);
      }
    });

    onCleanup(unsubscribe);
  });

  // Listen for agent failures
  onMount(() => {
    const handleAgentFailed = (e: Event) => {
      const customEvent = e as CustomEvent<{agentType: string, command: string}>;
      const notif = {
        message: `Agent "${customEvent.detail.agentType}" (${customEvent.detail.command}) is not installed. Using shell instead. Click to configure settings.`,
        type: 'warning' as const,
        onClick: () => {
          props.onSettingsOpen();
          setNotification(null);
        }
      };
      setNotification(notif);
      // Auto-dismiss after 8 seconds
      const currentMessage = notif.message;
      setTimeout(() => {
        setNotification((prev) => prev?.message === currentMessage ? null : prev);
      }, 8000);
    };

    window.addEventListener('codelane:agent-failed', handleAgentFailed);
    onCleanup(() => {
      window.removeEventListener('codelane:agent-failed', handleAgentFailed);
    });
  });

  return (
    <Show when={notification()}>
      {(notif) => (
        <div class="fixed top-4 right-4 z-50 max-w-md animate-slide-in">
          <div
            class={`rounded-lg shadow-lg border p-4 flex items-start gap-3 transition-all select-none ${
              notif().onClick ? 'cursor-pointer hover:bg-opacity-80 active:scale-[0.98]' : ''
            } ${
              notif().type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : notif().type === 'warning'
                ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
            }`}
            onClick={() => notif().onClick?.()}
          >
            <div class="flex-shrink-0 mt-0.5">
              {notif().type === 'warning' ? (
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              ) : (
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              )}
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium">{notif().message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setNotification(null); }}
              class="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity p-1 rounded-full hover:bg-black/20 cursor-pointer select-none"
              aria-label="Close notification"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </Show>
  );
}
