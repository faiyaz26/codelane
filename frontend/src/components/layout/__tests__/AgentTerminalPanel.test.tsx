import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@solidjs/testing-library';
import { AgentTerminalPanel } from '../AgentTerminalPanel';
import type { Lane } from '../../../types/lane';
import { batch, createSignal, Show } from 'solid-js';
import type { AgentSettings } from '../../../types/agent';

// Mock the sub-components
const TerminalViewSpy = vi.fn((props: any) => (
  <div data-testid={`terminal-${props.laneId}`} data-cwd={props.cwd}>
    Terminal for {props.laneId}
  </div>
));

vi.mock('../../TerminalView', () => ({
  TerminalView: (props: any) => TerminalViewSpy(props)
}));

// Mock the UI components
vi.mock('../../ui', () => ({
  Dialog: (props: any) => {
    return (
      <Show when={props.open}>
        <div 
          data-testid={`dialog-${props.title?.toLowerCase().replace(/\s+/g, '-') || 'default'}`}
        >
          {typeof props.children === 'function' ? props.children(() => props.onOpenChange(false)) : props.children}
        </div>
      </Show>
    );
  },
  Button: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
}));

// Mock API and settings
vi.mock('../../../lib/settings-api', () => ({
  getAgentSettings: vi.fn(async () => ({
    defaultAgentName: 'Shell',
    installedAgents: [
      { name: 'Shell', agentType: 'shell', command: 'zsh', args: [], env: {}, useLaneCwd: true },
      { name: 'Gemini', agentType: 'gemini', command: 'gemini', args: [], env: {}, useLaneCwd: true }
    ]
  })),
  getDefaultAgent: vi.fn((s) => s.installedAgents[0])
}));

vi.mock('../../../lib/lane-api', () => ({
  updateLaneConfig: vi.fn(async () => {})
}));

const mockLanes: Lane[] = [
  {
    id: 'lane-1',
    name: 'Lane 1',
    workingDir: '/work/lane-1',
    createdAt: '0',
    updatedAt: '0',
    config: { env: [], lspServers: [] },
  },
  {
    id: 'lane-2',
    name: 'Lane 2',
    workingDir: '/work/lane-2',
    createdAt: '0',
    updatedAt: '0',
    config: { env: [], lspServers: [] },
  },
];

const mockAgentSettings: AgentSettings = {
  defaultAgentName: 'Shell',
  installedAgents: [
    { name: 'Shell', agentType: 'shell', command: 'zsh', args: [], env: {}, useLaneCwd: true },
    { name: 'Gemini', agentType: 'gemini', command: 'gemini', args: [], env: {}, useLaneCwd: true }
  ]
};

describe('AgentTerminalPanel Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('preserves terminal instances when switching between lanes', async () => {
    const [activeLaneId, setActiveLaneId] = createSignal<string | null>('lane-1');
    const [initializedLanes, setInitializedLanes] = createSignal(new Set(['lane-1', 'lane-2']));
    const [terminalReloadVersions] = createSignal(new Map<string, number>());

    render(() => (
      <AgentTerminalPanel
        lanes={mockLanes}
        agentSettings={mockAgentSettings}
        activeLaneId={activeLaneId()}
        initializedLanes={initializedLanes()}
        terminalReloadVersions={terminalReloadVersions()}
        showEditor={false}
        panelWidth={null}
      />
    ));

    // Wait for settings to load
    await waitFor(() => expect(screen.getByTestId('terminal-lane-1')).toBeInTheDocument());
    
    // Both terminals should be mounted (since both are in initializedLanes)
    expect(screen.getByTestId('terminal-lane-1')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-lane-2')).toBeInTheDocument();
    
    // Initial mount count should be 1 for each (once for lane-1, once for lane-2)
    const initialLane1Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-1').length;
    const initialLane2Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-2').length;
    
    expect(initialLane1Mounts).toBe(1);
    expect(initialLane2Mounts).toBe(1);

    const lane1Terminal = screen.getByTestId('terminal-lane-1');
    const lane2Terminal = screen.getByTestId('terminal-lane-2');

    // Switch to lane 2 while recreating the initialized set, matching App.handleLaneSelect.
    batch(() => {
      setActiveLaneId('lane-2');
      setInitializedLanes(prev => new Set(prev));
    });

    // Terminals should still be in the document
    expect(screen.getByTestId('terminal-lane-1')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-lane-2')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-lane-1')).toBe(lane1Terminal);
    expect(screen.getByTestId('terminal-lane-2')).toBe(lane2Terminal);

    // CRITICAL: TerminalView should NOT have been re-mounted/re-called for either lane
    const afterSwitchLane1Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-1').length;
    const afterSwitchLane2Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-2').length;

    expect(afterSwitchLane1Mounts).toBe(initialLane1Mounts);
    expect(afterSwitchLane2Mounts).toBe(initialLane2Mounts);
  });

  it('reloads only the requested lane when its version changes', async () => {
    const [activeLaneId] = createSignal<string | null>('lane-1');
    const [initializedLanes] = createSignal(new Set(['lane-1', 'lane-2']));
    const [terminalReloadVersions, setTerminalReloadVersions] = createSignal(new Map<string, number>());

    render(() => (
      <AgentTerminalPanel
        lanes={mockLanes}
        agentSettings={mockAgentSettings}
        activeLaneId={activeLaneId()}
        initializedLanes={initializedLanes()}
        terminalReloadVersions={terminalReloadVersions()}
        showEditor={false}
        panelWidth={null}
      />
    ));

    await waitFor(() => expect(screen.getByTestId('terminal-lane-1')).toBeInTheDocument());

    const initialLane1Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-1').length;
    const initialLane2Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-2').length;

    setTerminalReloadVersions(prev => {
      const next = new Map(prev);
      next.set('lane-1', 1);
      return next;
    });

    await waitFor(() => {
      const lane1Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-1').length;
      expect(lane1Mounts).toBe(initialLane1Mounts + 1);
    });

    const lane2Mounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-2').length;
    expect(lane2Mounts).toBe(initialLane2Mounts);
  });

  it('reloads the terminal when an agent is switched and confirmed', async () => {
    const [activeLaneId, setActiveLaneId] = createSignal<string | null>('lane-1');
    const onReload = vi.fn();
    const terminalReloadVersions = new Map<string, number>();

    render(() => (
      <AgentTerminalPanel
        lanes={mockLanes}
        agentSettings={mockAgentSettings}
        activeLaneId={activeLaneId()}
        initializedLanes={new Set(['lane-1'])}
        terminalReloadVersions={terminalReloadVersions}
        showEditor={false}
        panelWidth={null}
        onReloadAgentTerminal={onReload}
      />
    ));

    await waitFor(() => expect(screen.getByTestId('terminal-lane-1')).toBeInTheDocument());
    const initialMounts = TerminalViewSpy.mock.calls.filter(call => call[0].laneId === 'lane-1').length;
    expect(initialMounts).toBe(1);

    // Change agent to Gemini using the select
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Gemini' } });

    // Dialog should appear
    await waitFor(() => expect(screen.getByTestId('dialog-switch-ai-agent')).toBeInTheDocument());
    expect(screen.getByText(/Switching to/)).toBeInTheDocument();

    // Confirm switch
    const switchButton = screen.getByText('Switch Agent');
    fireEvent.click(switchButton);

    // Should have called onReload (wrapped in waitFor because of setTimeout 0)
    await waitFor(() => expect(onReload).toHaveBeenCalledWith('lane-1'));
  });
});
