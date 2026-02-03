import { Show, For, createMemo } from 'solid-js';
import { TabPanel } from '../tabs/TabPanel';
import type { Lane } from '../../types/lane';

interface BottomPanelProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
}

export function BottomPanel(props: BottomPanelProps) {
  return (
    <For each={Array.from(props.initializedLanes)}>
      {(laneId) => {
        const lane = createMemo(() => {
          if (laneId !== props.activeLaneId) return undefined;
          return props.lanes.find((l) => l.id === laneId);
        });

        return (
          <Show when={lane()}>
            {(laneData) => {
              // Capture values at render time to avoid stale accessors
              const id = laneData().id;
              // Use worktree path if available, otherwise use workingDir
              const effectiveWorkingDir = laneData().worktreePath || laneData().workingDir;

              return <TabPanel laneId={id} workingDir={effectiveWorkingDir} />;
            }}
          </Show>
        );
      }}
    </For>
  );
}
