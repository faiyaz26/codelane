import { Show } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isMacOS } from '../../lib/platform';

interface TopBarProps {
  activeLaneName?: string;
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

      {/* Active lane name - centered */}
      <div class="flex-1 flex items-center justify-center">
        <Show when={props.activeLaneName}>
          <span class="text-sm font-medium text-zed-text-secondary">
            {props.activeLaneName}
          </span>
        </Show>
      </div>

      {/* Windows/Linux window controls spacer (right side) */}
      <Show when={!isMacOS()}>
        <div class="w-[138px] flex-shrink-0" />
      </Show>
    </div>
  );
}
