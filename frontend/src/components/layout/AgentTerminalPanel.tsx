import { Show, For, createMemo, createSignal, createEffect, onMount } from 'solid-js';
import { TerminalView } from '../TerminalView';
import { Dialog, Button } from '../ui';
import type { Lane } from '../../types/lane';
import { getAgentSettings, getDefaultAgent } from '../../lib/settings-api';
import { updateLaneConfig } from '../../lib/lane-api';
import type { AgentConfig, AgentSettings } from '../../types/agent';

interface AgentTerminalPanelProps {
  lanes: Lane[];
  agentSettings: AgentSettings;
  activeLaneId: string | null;
  initializedLanes: Set<string>;
  terminalReloadVersions: Map<string, number>;
  showEditor: boolean;
  panelWidth: number | null;
  onLanesUpdated?: () => Promise<void>;
  onTerminalReady?: (laneId: string, terminalId: string) => void;
  onTerminalExit?: (laneId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
  onReloadAgentTerminal?: (laneId: string) => void;
}

function TerminalItem(props: {
  laneId: string;
  lane: Lane;
  version: number;
  isActive: boolean;
  onTerminalReady?: (terminalId: string) => void;
  onTerminalExit?: () => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}) {
  // Capture working directory
  const effectiveWorkingDir = () => props.lane.worktreePath || props.lane.workingDir;

  return (
    <div
      class="absolute inset-0 transition-opacity duration-150"
      style={{
        opacity: props.isActive ? '1' : '0',
        'pointer-events': props.isActive ? 'auto' : 'none',
        'z-index': props.isActive ? '1' : '0',
      }}
    >
      <TerminalView
        laneId={props.laneId}
        version={props.version}
        cwd={effectiveWorkingDir()}
        onTerminalReady={props.onTerminalReady}
        onTerminalExit={props.onTerminalExit}
        onAgentFailed={props.onAgentFailed}
      />
    </div>
  );
}

export function AgentTerminalPanel(props: AgentTerminalPanelProps) {
  const [showReloadConfirm, setShowReloadConfirm] = createSignal(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = createSignal(false);
  const [pendingAgent, setPendingAgent] = createSignal<AgentConfig | null>(null);

  const activeLane = createMemo(() => props.lanes.find(l => l.id === props.activeLaneId));
  const initializedLaneIds = createMemo(() => Array.from(props.initializedLanes));

  const currentAgent = createMemo(() => {
    const lane = activeLane();
    const settings = props.agentSettings;
    if (!lane || !settings) return null;
    
    // If lane has override, use it
    if (lane.config?.agentOverride) {
      return lane.config.agentOverride;
    }

    // Fallback to global default
    return getDefaultAgent(settings);
  });

  const currentAgentName = createMemo(() => {
    const agent = currentAgent();
    const settings = props.agentSettings;
    if (!agent || !settings) return '';
    
    if (agent.name) return agent.name;
    
    // Try to find name in installed agents if missing in config
    const found = settings.installedAgents.find(a => 
      a.command === agent.command && 
      a.agentType === agent.agentType &&
      JSON.stringify(a.args) === JSON.stringify(agent.args)
    );
    if (found) return found.name || found.agentType;
    
    return agent.agentType;
  });

  const handleReloadClick = () => {
    if (props.activeLaneId) {
      setShowReloadConfirm(true);
    }
  };

  const handleConfirmReload = async () => {
    const lane = activeLane();
    if (!lane || !props.activeLaneId) return;

    try {
      // Refresh global lanes state
      if (props.onLanesUpdated) {
        await props.onLanesUpdated();
      }
      
      // Reload terminal with current agent
      if (props.onReloadAgentTerminal) {
        const laneId = props.activeLaneId;
        setTimeout(() => {
          props.onReloadAgentTerminal?.(laneId);
        }, 0);
      }
    } catch (error) {
      console.error('Failed to reload terminal:', error);
    } finally {
      setShowReloadConfirm(false);
    }
  };

  const handleAgentSwitch = (agent: AgentConfig) => {
    const currentName = currentAgentName();
    const newName = agent.name || agent.agentType;
    
    // Don't do anything if it's the same agent
    if (newName === currentName) return;
    
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
      
      // Refresh global lanes state so the UI reflects the change
      if (props.onLanesUpdated) {
        await props.onLanesUpdated();
      }
      
      // Reload terminal with new agent
      if (props.onReloadAgentTerminal) {
        const laneId = props.activeLaneId;
        setTimeout(() => {
          props.onReloadAgentTerminal?.(laneId);
        }, 0);
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
          <Show when={props.agentSettings.installedAgents.length > 1 && props.activeLaneId}>
            <div class="flex items-center gap-2">
              <div class="h-4 w-[1px] bg-zed-border-subtle mx-1" />
              <select
                class="h-6 px-2 bg-transparent border-none text-[11px] font-medium text-zed-text-tertiary hover:text-zed-text-primary cursor-pointer focus:outline-none"
                value={currentAgentName()}
                onChange={(e) => {
                  const selectedName = e.currentTarget.value;
                  const agent = props.agentSettings.installedAgents.find(a => a.name === selectedName);
                  if (agent) handleAgentSwitch(agent);
                }}
              >
                <For each={props.agentSettings.installedAgents}>
                  {(agent) => (
                    <option value={agent.name}>{agent.name}</option>
                  )}
                </For>
              </select>
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
        </div>
      </div>

      {/* Terminal Content */}
      <div class="flex-1 overflow-hidden bg-zed-bg-surface relative">
        <For each={initializedLaneIds()}>
          {(laneId) => {
            const lane = createMemo(() => props.lanes.find((l) => l.id === laneId));
            const version = createMemo(() => props.terminalReloadVersions.get(laneId) ?? 0);
            const reloadKey = createMemo(() => `${version()}`);
            const isActive = createMemo(() => props.activeLaneId === laneId);

            return (
              <Show when={lane()}>
                {(laneData) => (
                  <Show when={reloadKey()} keyed>
                    {(currentVersion) => (
                      <TerminalItem
                        laneId={laneId}
                        lane={laneData()}
                        version={Number(currentVersion)}
                        isActive={isActive()}
                        onTerminalReady={(terminalId) => props.onTerminalReady?.(laneId, terminalId)}
                        onTerminalExit={() => props.onTerminalExit?.(laneId)}
                        onAgentFailed={props.onAgentFailed}
                      />
                    )}
                  </Show>
                )}
              </Show>
            );
          }}
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
