import { For, Show } from 'solid-js';
import type { Lane } from '../types/lane';

interface LaneListProps {
  lanes: Lane[];
  activeLaneId?: string;
  onLaneSelect: (laneId: string) => void;
  onLaneDelete?: (laneId: string) => void;
}

export function LaneList(props: LaneListProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div class="flex-1 p-2 space-y-2 overflow-y-auto">
      <Show
        when={props.lanes.length > 0}
        fallback={
          <div class="p-4 text-center text-sm text-zed-text-tertiary">
            No lanes yet. Create one to get started.
          </div>
        }
      >
        <For each={props.lanes}>
          {(lane) => (
            <div
              class={`p-3 rounded-md border cursor-pointer transition-colors ${
                props.activeLaneId === lane.id
                  ? 'bg-zed-bg-active border-zed-border-active'
                  : 'bg-zed-bg-panel border-zed-border-subtle hover:bg-zed-bg-hover hover:border-zed-border-default'
              }`}
              onClick={() => props.onLaneSelect(lane.id)}
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{lane.name}</div>
                  <div class="text-xs text-zed-text-tertiary mt-1 truncate" title={lane.workingDir}>
                    {lane.workingDir}
                  </div>
                  <div class="text-xs text-zed-text-tertiary mt-1">
                    Updated {formatDate(lane.updatedAt)}
                  </div>
                </div>
                <Show when={props.onLaneDelete}>
                  <button
                    class="ml-2 p-1 text-zed-text-tertiary hover:text-zed-accent-red transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onLaneDelete?.(lane.id);
                    }}
                    title="Close lane"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </Show>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
