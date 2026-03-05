import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@solidjs/testing-library';
import { MainLayout } from '../MainLayout';
import type { Lane } from '../../../types/lane';
import { createSignal } from 'solid-js';

// Mock all sub-components to keep the test focused on MainLayout's Show keyed logic
vi.mock('../TopBar', () => ({
  TopBar: () => <div data-testid="top-bar" />
}));

vi.mock('../ActivityBar', () => ({
  ActivityBar: () => <div data-testid="activity-bar" />,
  ActivityView: {
    Explorer: 'explorer',
    Search: 'search',
    GitManager: 'git_manager',
    CodeReview: 'code_review',
    Settings: 'settings',
  }
}));

vi.mock('../StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />
}));

vi.mock('../WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />
}));

vi.mock('../AgentTerminalPanel', () => ({
  AgentTerminalPanel: () => <div data-testid="agent-terminal" />
}));

// Mock Sidebar to capture its lane prop
const { SidebarSpy } = vi.hoisted(() => ({
  SidebarSpy: vi.fn((props: any) => (
    <div data-testid="sidebar" data-lane-id={props.lane.id} data-working-dir={props.effectiveWorkingDir}>
      Sidebar for {props.lane.name}
    </div>
  ))
}));
vi.mock('../Sidebar', () => ({
  Sidebar: SidebarSpy
}));

vi.mock('../BottomPanel', () => ({
  BottomPanel: () => <div data-testid="bottom-panel" />
}));

vi.mock('../ResizeHandle', () => ({
  ResizeHandle: () => <div data-testid="resize-handle" />
}));

vi.mock('../ProjectPanel', () => ({
  ProjectPanel: () => <div data-testid="project-panel" />
}));

vi.mock('../../editor', () => ({
  EditorPanel: () => <div data-testid="editor-panel" />
}));

vi.mock('../../review', () => ({
  CodeReviewLayout: () => <div data-testid="code-review-layout" />,
  ReviewErrorBoundary: (props: any) => props.children
}));

// Mock services
vi.mock('../../../services/EditorStateManager', () => ({
  editorStateManager: {
    hasOpenFiles: vi.fn(() => false),
    clearHighlight: vi.fn(),
    reloadOpenFiles: vi.fn(),
  }
}));

vi.mock('../../../services/CodeReviewStore', () => ({
  codeReviewStore: {
    state: { status: 'idle' }
  }
}));

const mockLanes: Lane[] = [
  {
    id: 'lane-1',
    name: 'Lane 1',
    workingDir: '/work/lane-1',
    createdAt: 0,
    updatedAt: 0,
    config: { env: [], lspServers: [] },
  },
  {
    id: 'lane-2',
    name: 'Lane 2',
    workingDir: '/work/lane-2',
    createdAt: 0,
    updatedAt: 0,
    config: { env: [], lspServers: [] },
  },
];

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('correctly remounts components with new lane data when switching lanes', async () => {
    const [activeLaneId, setActiveLaneId] = createSignal<string | null>('lane-1');

    const { getByTestId, rerender } = render(() => (
      <MainLayout
        lanes={mockLanes}
        activeLaneId={activeLaneId()}
        initializedLanes={new Set()}
        
        onLaneSelect={vi.fn()}
        onLaneDeleted={vi.fn()}
        onLaneRenamed={vi.fn()}
        onNewLane={vi.fn()}
        onSettingsOpen={vi.fn()}
        onAboutOpen={vi.fn()}
      />
    ));

    // Verify lane 1 is initially rendered
    expect(getByTestId('sidebar')).toHaveAttribute('data-lane-id', 'lane-1');
    expect(getByTestId('sidebar')).toHaveAttribute('data-working-dir', '/work/lane-1');
    expect(screen.getByText('Sidebar for Lane 1')).toBeInTheDocument();

    // Capture the sidebar element to check if it's the same instance (it should be since we removed 'keyed')
    const sidebarElement = getByTestId('sidebar');

    // Switch to lane 2
    setActiveLaneId('lane-2');
    
    // Verify lane 2 is rendered on the same component instance (reactive update)
    expect(getByTestId('sidebar')).toBe(sidebarElement);
    expect(getByTestId('sidebar')).toHaveAttribute('data-lane-id', 'lane-2');
    expect(getByTestId('sidebar')).toHaveAttribute('data-working-dir', '/work/lane-2');
    expect(screen.getByText('Sidebar for Lane 2')).toBeInTheDocument();
  });

  it('updates components when a lane is renamed (object changes)', async () => {
    const [lanes, setLanes] = createSignal<Lane[]>([...mockLanes]);
    
    render(() => (
      <MainLayout
        lanes={lanes()}
        activeLaneId="lane-1"
        initializedLanes={new Set()}
        onLaneSelect={vi.fn()}
        onLaneDeleted={vi.fn()}
        onLaneRenamed={vi.fn()}
        onNewLane={vi.fn()}
        onSettingsOpen={vi.fn()}
        onAboutOpen={vi.fn()}
      />
    ));

    expect(screen.getByText('Sidebar for Lane 1')).toBeInTheDocument();

    // Capture sidebar instance
    const sidebarElement = screen.getByTestId('sidebar');

    // Rename lane-1
    setLanes(prev => prev.map(l => l.id === 'lane-1' ? { ...l, name: 'Renamed Lane 1' } : l));

    // Verify it updated on the same instance
    expect(screen.getByTestId('sidebar')).toBe(sidebarElement);
    expect(screen.getByText('Sidebar for Renamed Lane 1')).toBeInTheDocument();
  });

  it('preserves the same AgentTerminalPanel instance when switching lanes', async () => {
    const [activeLaneId, setActiveLaneId] = createSignal<string | null>('lane-1');

    const { getByTestId } = render(() => (
      <MainLayout
        lanes={mockLanes}
        activeLaneId={activeLaneId()}
        initializedLanes={new Set(['lane-1', 'lane-2'])}
        
        onLaneSelect={vi.fn()}
        onLaneDeleted={vi.fn()}
        onLaneRenamed={vi.fn()}
        onNewLane={vi.fn()}
        onSettingsOpen={vi.fn()}
        onAboutOpen={vi.fn()}
      />
    ));

    // Capture the terminal element instance
    const terminalElement = getByTestId('agent-terminal');

    // Switch to lane 2
    setActiveLaneId('lane-2');

    // Verify it is the EXACT SAME instance (no remount)
    expect(getByTestId('agent-terminal')).toBe(terminalElement);
  });

  it('shows welcome screen when no lane is active', () => {
    render(() => (
      <MainLayout
        lanes={mockLanes}
        activeLaneId={null}
        initializedLanes={new Set()}
        
        onLaneSelect={vi.fn()}
        onLaneDeleted={vi.fn()}
        onLaneRenamed={vi.fn()}
        onNewLane={vi.fn()}
        onSettingsOpen={vi.fn()}
        onAboutOpen={vi.fn()}
      />
    ));

    expect(screen.getByTestId('welcome-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
  });
});
