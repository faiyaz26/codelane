import { createSignal, Show, createMemo, createEffect, batch } from 'solid-js';
import { TopBar } from './TopBar';
import { ActivityBar, ActivityView } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { WelcomeScreen } from './WelcomeScreen';
import { AgentTerminalPanel } from './AgentTerminalPanel';
import { Sidebar } from './Sidebar';
import { BottomPanel } from './BottomPanel';
import { ResizeHandle } from './ResizeHandle';
import { EditorPanel } from '../editor';
import { editorStateManager } from '../../services/EditorStateManager';
import { getLanguageDisplayName } from '../editor/types';
import type { Lane } from '../../types/lane';

interface MainLayoutProps {
  lanes: Lane[];
  activeLaneId: string | null;
  initializedLanes: Set<string>;
  onLaneSelect: (laneId: string) => void;
  onLaneClose: (laneId: string) => void;
  onNewLane: () => void;
  onSettingsOpen: () => void;
  onTerminalReady?: (laneId: string, terminalId: string) => void;
  onTerminalExit?: (laneId: string) => void;
  onAgentFailed?: (agentType: string, command: string) => void;
}

// Constants for panel sizing
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 260;
const AGENT_PANEL_MIN_WIDTH = 300;
const AGENT_PANEL_MAX_WIDTH = 800;

export function MainLayout(props: MainLayoutProps) {
  // Panel state
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

  // Clear highlights when switching away from search view
  createEffect(() => {
    const view = activeView();
    const lane = activeLane();
    if (lane && view !== ActivityView.Search) {
      editorStateManager.clearHighlight(lane.id);
    }
  });

  // Resize handlers
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
        lanes={props.lanes}
        activeLaneId={props.activeLaneId}
        onLaneSelect={props.onLaneSelect}
        onLaneClose={props.onLaneClose}
        onNewLane={props.onNewLane}
      />

      <div class="flex-1 flex overflow-hidden">
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
                />

                {/* Editor - Center */}
                <Show when={showEditor() && props.activeLaneId}>
                  <ResizeHandle direction="left" onResize={handleAgentPanelResize} />
                  <div class="flex flex-col overflow-hidden min-w-0 flex-1">
                    <EditorPanel
                      laneId={props.activeLaneId!}
                      basePath={lane().workingDir}
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
        totalLanes={props.lanes.length}
        fileInfo={fileInfo()}
      />
    </div>
  );
}
