import { createSignal, Show, createMemo, createEffect, batch } from 'solid-js';
import { TopBar } from './TopBar';
import { ActivityBar, ActivityView } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { WelcomeScreen } from './WelcomeScreen';
import { AgentTerminalPanel } from './AgentTerminalPanel';
import { Sidebar } from './Sidebar';
import { BottomPanel } from './BottomPanel';
import { ResizeHandle } from './ResizeHandle';
import { ProjectPanel } from './ProjectPanel';
import { EditorPanel } from '../editor';
import { editorStateManager } from '../../services/EditorStateManager';
import { getLanguageDisplayName } from '../editor/types';
import type { Lane } from '../../types/lane';

interface MainLayoutProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
  onLaneSelect: (laneId: string) => void;
  onLaneDeleted: (laneId: string) => void;
  onLaneRenamed: (lane: Lane) => void;
  onNewLane: () => void;
  onSettingsOpen: () => void;
  onTerminalReady?: (laneId: string, terminalId: string) => void;
  onTerminalExit?: (laneId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
  onReloadTerminal?: (laneId: string) => void;
}

// Constants for panel sizing
const PROJECT_PANEL_MIN_WIDTH = 160;
const PROJECT_PANEL_MAX_WIDTH = 350;
const PROJECT_PANEL_DEFAULT_WIDTH = 200;
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 260;
const AGENT_PANEL_MIN_WIDTH = 300;
const AGENT_PANEL_MAX_WIDTH = 800;

export function MainLayout(props: MainLayoutProps) {
  // Panel state
  const [projectPanelWidth, setProjectPanelWidth] = createSignal(PROJECT_PANEL_DEFAULT_WIDTH);
  const [sidebarWidth, setSidebarWidth] = createSignal(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [agentPanelWidth, setAgentPanelWidth] = createSignal<number | null>(null);

  // Lane-specific state (tracked per lane)
  const [laneActiveViews, setLaneActiveViews] = createSignal<Map<string, ActivityView>>(new Map());
  const [selectedFiles, setSelectedFiles] = createSignal<Map<string, string>>(new Map());

  // Derived state
  const activeLane = createMemo(() => props.lanes.find((l) => l.id === props.activeLaneId));

  const activeView = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return ActivityView.Explorer;
    return laneActiveViews().get(laneId) || ActivityView.Explorer;
  });

  const selectedFile = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return undefined;
    return selectedFiles().get(laneId);
  });

  const showEditor = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return false;
    return editorStateManager.hasOpenFiles(laneId) || selectedFile() !== undefined;
  });

  const fileInfo = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return null;

    const activeFileId = editorStateManager.getActiveFileId(laneId);
    if (!activeFileId) return null;

    const files = editorStateManager.getOpenFiles(laneId);
    const file = files[activeFileId];
    if (!file) return null;

    return { language: getLanguageDisplayName(file.language) };
  });

  // Actions
  const setActiveView = (view: ActivityView) => {
    const laneId = props.activeLaneId;
    if (!laneId) return;
    batch(() => {
      setLaneActiveViews((prev) => {
        const newMap = new Map(prev);
        newMap.set(laneId, view);
        return newMap;
      });
    });
  };

  const setSelectedFile = (path: string | undefined) => {
    const laneId = props.activeLaneId;
    if (!laneId) return;

    setSelectedFiles((prev) => {
      const next = new Map(prev);
      if (path) {
        next.set(laneId, path);
      } else {
        next.delete(laneId);
      }
      return next;
    });
  };

  // Get effective working directory (worktree path if available, otherwise workingDir)
  const getEffectiveWorkingDir = (lane: Lane): string => {
    return lane.worktreePath || lane.workingDir;
  };

  // Clear highlights when switching away from search view
  createEffect(() => {
    const view = activeView();
    const lane = activeLane();
    if (lane && view !== ActivityView.Search) {
      editorStateManager.clearHighlight(lane.id);
    }
  });

  // Resize handlers
  const handleProjectPanelResize = (delta: number) => {
    const newWidth = Math.max(PROJECT_PANEL_MIN_WIDTH, Math.min(PROJECT_PANEL_MAX_WIDTH, projectPanelWidth() + delta));
    setProjectPanelWidth(newWidth);
  };

  const handleSidebarResize = (delta: number) => {
    const newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, sidebarWidth() + delta));
    setSidebarWidth(newWidth);
  };

  const handleAgentPanelResize = (delta: number) => {
    const currentWidth = agentPanelWidth() ?? 400;
    const newWidth = Math.max(AGENT_PANEL_MIN_WIDTH, Math.min(AGENT_PANEL_MAX_WIDTH, currentWidth + delta));
    setAgentPanelWidth(newWidth);
  };

  return (
    <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
      <TopBar
        activeLaneName={activeLane()?.name}
        effectiveWorkingDir={activeLane() ? getEffectiveWorkingDir(activeLane()!) : undefined}
      />

      <div class="flex-1 flex overflow-hidden">
        <ProjectPanel
          lanes={props.lanes}
          activeLaneId={props.activeLaneId}
          width={projectPanelWidth()}
          onLaneSelect={props.onLaneSelect}
          onLaneDeleted={props.onLaneDeleted}
          onLaneRenamed={props.onLaneRenamed}
          onNewLane={props.onNewLane}
        />
        <ResizeHandle direction="left" onResize={handleProjectPanelResize} />
        <Show when={activeLane()} fallback={<WelcomeScreen onNewLane={props.onNewLane} />}>
          {(lane) => (
            <div class="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Main content row */}
              <div class="flex-1 flex overflow-hidden">
                {/* Agent Terminal - Left */}
                <AgentTerminalPanel
                  lanes={props.lanes}
                  activeLaneId={props.activeLaneId}
                  initializedLanes={props.initializedLanes}
                  showEditor={showEditor()}
                  panelWidth={agentPanelWidth()}
                  onTerminalReady={props.onTerminalReady}
                  onTerminalExit={props.onTerminalExit}
                  onAgentFailed={props.onAgentFailed}
                  onReloadTerminal={props.onReloadTerminal}
                />

                {/* Editor - Center */}
                <Show when={showEditor() && props.activeLaneId}>
                  <ResizeHandle direction="left" onResize={handleAgentPanelResize} />
                  <div class="flex flex-col overflow-hidden min-w-0 flex-1">
                    <EditorPanel
                      laneId={props.activeLaneId!}
                      basePath={getEffectiveWorkingDir(lane())}
                      selectedFilePath={selectedFile()}
                      onAllFilesClosed={() => setSelectedFile(undefined)}
                    />
                  </div>
                </Show>

                {/* Sidebar resize handle */}
                <Show when={!sidebarCollapsed()}>
                  <ResizeHandle direction="right" onResize={handleSidebarResize} />
                </Show>

                {/* Sidebar */}
                <Sidebar
                  lane={lane()}
                  effectiveWorkingDir={getEffectiveWorkingDir(lane())}
                  activeView={activeView()}
                  width={sidebarWidth()}
                  collapsed={sidebarCollapsed()}
                  onFileSelect={setSelectedFile}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed())}
                />
              </div>

              {/* Bottom Panel */}
              <BottomPanel
                lanes={props.lanes}
                activeLaneId={props.activeLaneId}
                initializedLanes={props.initializedLanes}
              />
            </div>
          )}
        </Show>

        {/* Activity Bar - Rightmost */}
        <ActivityBar
          activeView={activeView()}
          onViewChange={setActiveView}
          onSettingsOpen={props.onSettingsOpen}
          sidebarCollapsed={sidebarCollapsed()}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed())}
        />
      </div>

      <StatusBar
        activeLane={activeLane()}
        fileInfo={fileInfo()}
      />
    </div>
  );
}
