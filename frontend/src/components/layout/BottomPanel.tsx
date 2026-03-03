import { Show, For, createMemo, createEffect } from 'solid-js';
import { TabPanel } from '../tabs/TabPanel';
import type { Lane } from '../../types/lane';

interface BottomPanelProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
}

export function BottomPanel(props: BottomPanelProps) {
  // Trigger terminal refit when active lane changes (display:none → contents transition)
  createEffect((prev: string | null | undefined) => {
    const current = props.activeLaneId;
    if (current && prev !== current) {
      setTimeout(() => window.dispatchEvent(new Event('terminal-resize')), 50);
    }
    return current;
  });

  return (
    <For each={Array.from(props.initializedLanes)}>
      {(laneId) => {
        const lane = createMemo(() => props.lanes.find((l) => l.id === laneId));
        const isActive = createMemo(() => props.activeLaneId === laneId);

        return (
          <Show when={lane()}>
            {(laneData) => {
              // Capture values at render time to avoid stale accessors
              const id = laneData().id;
              // Use worktree path if available, otherwise use workingDir
              const effectiveWorkingDir = laneData().worktreePath || laneData().workingDir;

              return (
                <div style={{ display: isActive() ? 'contents' : 'none' }}>
                  <TabPanel laneId={id} workingDir={effectiveWorkingDir} />
                </div>
              );
            }}
          </Show>
        );
      }}
    </For>
  );
}
