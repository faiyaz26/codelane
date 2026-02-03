import { Show, For, createMemo } from 'solid-js';
import { TerminalView } from '../TerminalView';
import { ProcessMonitor } from '../ProcessMonitor';
import type { Lane } from '../../types/lane';

interface AgentTerminalPanelProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
  showEditor: boolean;
  panelWidth: number | null;
  onTerminalReady?: (laneId: string, terminalId: string) => void;
  onTerminalExit?: (laneId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

export function AgentTerminalPanel(props: AgentTerminalPanelProps) {
  return (
    <div
      class={`flex flex-col overflow-hidden ${
        props.showEditor
          ? props.panelWidth === null
            ? 'flex-1'  // 50% split
            : 'flex-shrink-0'  // custom width
          : 'flex-1'  // no file - full width
      }`}
      style={{
        width: props.showEditor && props.panelWidth !== null ? `${props.panelWidth}px` : 'auto'
      }}
    >
      {/* Header */}
      <div class="panel-header justify-between bg-zed-bg-panel">
        <h3 class="panel-header-title">Agent Terminal</h3>
        <div class="flex items-center gap-2">
          <ProcessMonitor laneId={props.activeLaneId} />
        </div>
      </div>

      {/* Terminal Content */}
      <div class="flex-1 overflow-hidden bg-zed-bg-surface relative">
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
                    <div
                      class="absolute inset-0 transition-opacity duration-150"
                      style={{
                        opacity: isActive() ? '1' : '0',
                        'pointer-events': isActive() ? 'auto' : 'none',
                        'z-index': isActive() ? '1' : '0',
                      }}
                    >
                      <TerminalView
                        laneId={id}
                        cwd={effectiveWorkingDir}
                        onTerminalReady={(terminalId) => {
                          props.onTerminalReady?.(id, terminalId);
                        }}
                        onTerminalExit={() => {
                          props.onTerminalExit?.(id);
                        }}
                        onAgentFailed={props.onAgentFailed}
                      />
                    </div>
                  );
                }}
              </Show>
            );
          }}
        </For>
      </div>
    </div>
  );
}
