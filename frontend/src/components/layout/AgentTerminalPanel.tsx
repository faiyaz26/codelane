import { Show, For, createMemo, createSignal, createEffect, onMount } from 'solid-js';
import { TerminalView } from '../TerminalView';
import { ProcessMonitor } from '../ProcessMonitor';
import { Dialog, Button, Select } from '../ui';
import type { Lane } from '../../types/lane';
import { getAgentSettings, getDefaultAgent } from '../../lib/settings-api';
import { updateLaneConfig } from '../../lib/lane-api';
import type { AgentConfig, AgentSettings } from '../../types/agent';

interface AgentTerminalPanelProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
  reloadingLanes: Set<string>;
  showEditor: boolean;
  panelWidth: number | null;
  onTerminalReady?: (laneId: string, terminalId: string) => void;
  onTerminalExit?: (laneId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
  onReloadTerminal?: (laneId: string) => void;
}

export function AgentTerminalPanel(props: AgentTerminalPanelProps) {
  const [showReloadConfirm, setShowReloadConfirm] = createSignal(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = createSignal(false);
  const [agentSettings, setAgentSettings] = createSignal<AgentSettings | null>(null);
  const [pendingAgent, setPendingAgent] = createSignal<AgentConfig | null>(null);

  onMount(async () => {
    const settings = await getAgentSettings();
    setAgentSettings(settings);
  });

  const activeLane = createMemo(() => props.lanes.find(l => l.id === props.activeLaneId));

  const currentAgent = createMemo(() => {
    const lane = activeLane();
    const settings = agentSettings();
    if (!lane || !settings) return null;
    
    // If lane has override, use it
    if (lane.config?.agentOverride) {
      return lane.config.agentOverride;
    }

    // Fallback to global default
    return getDefaultAgent(settings);
  });

  const handleReloadClick = () => {
    if (props.activeLaneId) {
      setShowReloadConfirm(true);
    }
  };

  const handleConfirmReload = () => {
    if (props.activeLaneId && props.onReloadTerminal) {
      props.onReloadTerminal(props.activeLaneId);
    }
    setShowReloadConfirm(false);
  };

  const handleAgentSwitch = (agent: AgentConfig) => {
    const current = currentAgent();
    // Don't do anything if it's the same agent (compare by name or type+command)
    if (current && (agent.name === current.name && agent.command === current.command)) return;
    
    setPendingAgent(agent);
    setShowSwitchConfirm(true);
  };

  const handleCancelSwitch = () => {
    setShowSwitchConfirm(false);
    setPendingAgent(null);
  };

  const confirmAgentSwitch = async () => {
    const lane = activeLane();
    const agent = pendingAgent();
    if (!lane || !agent || !props.activeLaneId) return;

    try {
      const newConfig = {
        ...(lane.config || { env: [], lspServers: [] }),
        agentOverride: { ...agent }
      };

      await updateLaneConfig(props.activeLaneId, newConfig);
      
      // Reload terminal with new agent
      if (props.onReloadTerminal) {
        props.onReloadTerminal(props.activeLaneId);
      }
    } catch (error) {
      console.error('Failed to switch agent:', error);
    } finally {
      setShowSwitchConfirm(false);
      setPendingAgent(null);
    }
  };

  // Trigger terminal refit when active lane changes (opacity-hidden terminals need refresh)
  createEffect((prev: string | null | undefined) => {
    const current = props.activeLaneId;
    if (current && prev !== current) {
      // Small delay to let opacity transition start and layout settle
      setTimeout(() => {
        window.dispatchEvent(new Event('terminal-resize'));
        window.dispatchEvent(new CustomEvent('terminal-focus', { detail: { laneId: current } }));
      }, 50);
    }
    return current;
  });

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
      <div class="panel-header justify-between bg-zed-bg-panel border-b border-zed-border-subtle">
        <div class="flex items-center gap-3">
          <h3 class="panel-header-title">Agent Terminal</h3>
          
          {/* Agent Switcher */}
          <Show when={agentSettings() && agentSettings()!.installedAgents.length > 1 && props.activeLaneId}>
            <div class="flex items-center">
              <div class="h-4 w-[1px] bg-zed-border-subtle mx-2" />
              <Select
                options={agentSettings()!.installedAgents}
                optionValue="name"
                optionLabel="name"
                value={currentAgent()}
                onChange={(agent) => handleAgentSwitch(agent)}
                triggerClass="!h-6 !px-2 !bg-transparent !border-none hover:!bg-zed-bg-hover !text-[11px] !font-medium !text-zed-text-tertiary hover:!text-zed-text-primary"
              />
            </div>
          </Show>
        </div>

        <div class="flex items-center gap-2">
          {/* Reload Button */}
          <Show when={props.activeLaneId}>
            <button
              class="w-6 h-6 flex items-center justify-center rounded text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover transition-colors"
              onClick={handleReloadClick}
              title="Reload terminal"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </Show>
          <ProcessMonitor laneId={props.activeLaneId} />
        </div>
      </div>

      {/* Terminal Content */}
      <div class="flex-1 overflow-hidden bg-zed-bg-surface relative">
        <For each={Array.from(props.initializedLanes)}>
          {(laneId) => (
            <Show when={!props.reloadingLanes.has(laneId)}>
              {() => {
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
            </Show>
          )}
        </For>
      </div>

      {/* Reload Confirmation Dialog */}
      <Dialog
        open={showReloadConfirm()}
        onOpenChange={setShowReloadConfirm}
        title="Reload Agent Terminal"
      >
        <div class="space-y-4">
          <p class="text-sm text-zed-text-secondary">
            Are you sure you want to reload the agent terminal? This will terminate the current session and discard any unsaved work.
          </p>
          <div class="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowReloadConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmReload}
            >
              Reload
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Switch Agent Confirmation Dialog */}
      <Dialog
        open={showSwitchConfirm()}
        onOpenChange={(open) => {
          if (!open) handleCancelSwitch();
        }}
        title="Switch AI Agent"
      >
        <div class="space-y-4">
          <p class="text-sm text-zed-text-secondary">
            Switching to <span class="font-semibold text-zed-text-primary">{pendingAgent()?.name || pendingAgent()?.agentType}</span> will terminate your current session and start a new one. 
            Unsaved work in the terminal will be lost.
          </p>
          <div class="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleCancelSwitch}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmAgentSwitch}
            >
              Switch Agent
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
