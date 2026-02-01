import { For, Show } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isMacOS } from '../../lib/platform';
import type { Lane } from '../../types/lane';

interface TopBarProps {
  lanes: Lane[];
  activeLaneId: string | null;
  onLaneSelect: (laneId: string) => void;
  onLaneClose: (laneId: string) => void;
  onNewLane: () => void;
}

export function TopBar(props: TopBarProps) {
  const handleTitleBarMouseDown = async (e: MouseEvent) => {
    // Only trigger drag on the background, not on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-drag]')) {
      return;
    }

    if (e.button === 0) {
      if (e.detail === 2) {
        // Double click - toggle maximize
        const window = getCurrentWindow();
        await window.toggleMaximize();
      } else {
        // Single click - start dragging
        const window = getCurrentWindow();
        await window.startDragging();
      }
    }
  };

  return (
    <div
      class="h-11 bg-zed-bg-panel border-b border-zed-border-subtle flex items-center select-none"
      onMouseDown={handleTitleBarMouseDown}
    >
      {/* macOS traffic light spacer (left side) */}
      <Show when={isMacOS()}>
        <div class="w-[78px] flex-shrink-0" />
      </Show>

      {/* Lane Tabs */}
      <div class="flex-1 flex items-center h-full overflow-x-auto ml-px">
        <For each={props.lanes}>
          {(lane) => (
            <div
              data-no-drag
              class={`group h-full flex items-center gap-2 px-4 border-r border-zed-border-subtle cursor-pointer transition-colors ${
                lane.id === props.activeLaneId
                  ? 'bg-zed-bg-surface text-zed-text-primary'
                  : 'text-zed-text-secondary hover:bg-zed-bg-hover hover:text-zed-text-primary'
              }`}
              onClick={() => props.onLaneSelect(lane.id)}
            >
              {/* Lane icon */}
              <svg
                class={`w-4 h-4 flex-shrink-0 ${
                  lane.id === props.activeLaneId ? 'text-zed-accent-blue' : 'text-zed-text-tertiary'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>

              {/* Lane name */}
              <span class="text-sm font-medium truncate max-w-[150px]">{lane.name}</span>

              {/* Close button */}
              <button
                class="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-zed-bg-active transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onLaneClose(lane.id);
                }}
                title="Close lane"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </For>

        {/* New Lane Button */}
        <button
          class="h-full px-3 flex items-center justify-center text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover transition-colors"
          onClick={props.onNewLane}
          title="New Lane"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Windows/Linux window controls spacer (right side) */}
      <Show when={!isMacOS()}>
        <div class="w-[138px] flex-shrink-0" />
      </Show>
    </div>
  );
}
