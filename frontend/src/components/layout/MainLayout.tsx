import { createSignal, Show, For, createMemo, createEffect } from 'solid-js';
import { TopBar } from './TopBar';
import { ActivityBar, type ActivityView } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { EditorPanel } from '../editor';
import { FileExplorer } from '../explorer/FileExplorer';
import { TerminalView } from '../TerminalView';
import { TabPanel } from '../tabs/TabPanel';
import { ProcessMonitor } from '../ProcessMonitor';
import { editorStateManager } from '../../services/EditorStateManager';
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

export function MainLayout(props: MainLayoutProps) {
  const [activeView, setActiveView] = createSignal<ActivityView>('explorer');
  const [sidebarWidth, setSidebarWidth] = createSignal(260);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [agentPanelWidth, setAgentPanelWidth] = createSignal<number | null>(null); // null = use 50%
  // Track selected file per lane
  const [selectedFiles, setSelectedFiles] = createSignal<Map<string, string>>(new Map());
  const [isResizingSidebar, setIsResizingSidebar] = createSignal(false);
  const [isResizingAgent, setIsResizingAgent] = createSignal(false);

  const activeLane = createMemo(() => {
    return props.lanes.find((l) => l.id === props.activeLaneId);
  });

  // Get selected file for current lane
  const selectedFile = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return undefined;
    return selectedFiles().get(laneId);
  });

  // Set selected file for current lane
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

  // Check if editor should be shown (has open files OR a file is being selected)
  const showEditor = createMemo(() => {
    const laneId = props.activeLaneId;
    if (!laneId) return false;
    // Access update signal for reactivity
    editorStateManager.getUpdateSignal()();
    // Show editor if there are open files OR a file is being selected
    return editorStateManager.hasOpenFiles(laneId) || selectedFile() !== undefined;
  });

  // Sidebar resize handler
  const handleSidebarResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);

    const startX = e.clientX;
    const startWidth = sidebarWidth();

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Agent panel resize handler
  const handleAgentResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizingAgent(true);

    const startX = e.clientX;
    // Get current width from element if using 50% default
    const agentPanel = (e.target as HTMLElement).nextElementSibling as HTMLElement;
    const startWidth = agentPanelWidth() ?? agentPanel?.offsetWidth ?? 400;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.max(300, Math.min(800, startWidth + delta));
      setAgentPanelWidth(newWidth); // User has customized, now use fixed width
    };

    const handleMouseUp = () => {
      setIsResizingAgent(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div class="h-screen w-screen flex flex-col bg-zed-bg-app text-zed-text-primary">
      {/* Top Bar with Lane Tabs */}
      <TopBar
        lanes={props.lanes}
        activeLaneId={props.activeLaneId}
        onLaneSelect={props.onLaneSelect}
        onLaneClose={props.onLaneClose}
        onNewLane={props.onNewLane}
      />

      {/* Main Content */}
      <div class="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <ActivityBar
          activeView={activeView()}
          onViewChange={setActiveView}
          onSettingsOpen={props.onSettingsOpen}
          sidebarCollapsed={sidebarCollapsed()}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed())}
        />

        <Show
          when={activeLane()}
          fallback={
            <div class="flex-1 flex items-center justify-center">
              <div class="text-center max-w-md">
                <svg
                  class="w-20 h-20 mx-auto mb-6 text-zed-accent-blue opacity-30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                >
                  <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                </svg>
                <h2 class="text-2xl font-bold text-zed-text-primary mb-3">Welcome to Codelane</h2>
                <p class="text-zed-text-secondary mb-6">
                  AI Orchestrator for Local Development. Create a lane to get started with your project.
                </p>
                <button
                  class="px-6 py-2.5 bg-zed-accent-blue hover:bg-zed-accent-blueHover text-white rounded-md font-medium transition-colors"
                  onClick={props.onNewLane}
                >
                  Create Your First Lane
                </button>
              </div>
            </div>
          }
        >
          {/* Collapsed Sidebar Handle */}
          <Show when={sidebarCollapsed()}>
            <div class="flex flex-col bg-zed-bg-panel border-r border-zed-border-subtle">
              {/* Expand button aligned with Agent Terminal header */}
              <div class="h-10 flex items-center justify-center">
                <button
                  class="p-1 text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
                  onClick={() => setSidebarCollapsed(false)}
                  title="Expand explorer"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </Show>

          {/* Sidebar (File Explorer) */}
          <Show when={!sidebarCollapsed()}>
            <div
              class="flex-shrink-0 bg-zed-bg-panel border-r border-zed-border-subtle overflow-hidden"
              style={{ width: `${sidebarWidth()}px` }}
            >
              <Show when={activeView() === 'explorer' && activeLane()}>
                <FileExplorer
                  workingDir={activeLane()!.workingDir}
                  onFileSelect={setSelectedFile}
                  collapsed={sidebarCollapsed()}
                  onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed())}
                />
              </Show>
              <Show when={activeView() === 'search'}>
                <div class="p-4 text-center text-zed-text-tertiary text-sm">
                  <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search coming soon
                </div>
              </Show>
              <Show when={activeView() === 'git'}>
                <div class="p-4 text-center text-zed-text-tertiary text-sm">
                  <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  Source Control coming soon
                </div>
              </Show>
              <Show when={activeView() === 'extensions'}>
                <div class="p-4 text-center text-zed-text-tertiary text-sm">
                  <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                  Extensions coming soon
                </div>
              </Show>
            </div>

            {/* Sidebar Resize Handle */}
            <div
              class={`w-1 cursor-col-resize hover:bg-zed-accent-blue/50 transition-colors ${
                isResizingSidebar() ? 'bg-zed-accent-blue' : ''
              }`}
              onMouseDown={handleSidebarResizeStart}
            />
          </Show>

          {/* Main Content Area (Editor + Agent on top, Bottom Panel below) */}
          <div class="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top Row: Editor and Agent side by side */}
            <div class="flex-1 flex overflow-hidden">
              {/* Editor Area - Only show when lane has open files */}
              <Show when={showEditor() && props.activeLaneId}>
                <div
                  class="flex flex-col overflow-hidden min-w-0"
                  style={{ flex: agentPanelWidth() === null ? '1' : '1' }}
                >
                  <EditorPanel
                    laneId={props.activeLaneId!}
                    selectedFilePath={selectedFile()}
                    onAllFilesClosed={() => setSelectedFile(undefined)}
                  />
                </div>

                {/* Agent Panel Resize Handle - Only show when editor is visible */}
                <div
                  class={`w-1 cursor-col-resize hover:bg-zed-accent-blue/50 transition-colors ${
                    isResizingAgent() ? 'bg-zed-accent-blue' : ''
                  }`}
                  onMouseDown={handleAgentResizeStart}
                />
              </Show>

              {/* Agent Terminal Panel - Full width when no file, 50% or custom width when file selected */}
              <div
                class={`flex flex-col overflow-hidden ${
                  showEditor()
                    ? agentPanelWidth() === null
                      ? 'flex-1 border-l border-zed-border-subtle'  // 50% split
                      : 'flex-shrink-0 border-l border-zed-border-subtle'  // custom width
                    : 'flex-1'  // no file - full width
                }`}
                style={{
                  width: showEditor() && agentPanelWidth() !== null ? `${agentPanelWidth()}px` : 'auto'
                }}
              >
            {/* Agent Terminal Header */}
            <div class="h-10 border-b border-zed-border-subtle bg-zed-bg-panel px-4 flex items-center justify-between flex-shrink-0">
              <h3 class="text-xs font-semibold text-zed-text-secondary uppercase tracking-wide">Agent Terminal</h3>
              <div class="flex items-center gap-2">
                <ProcessMonitor laneId={props.activeLaneId} />
              </div>
            </div>

            {/* Agent Terminal Content */}
            <div class="flex-1 overflow-hidden bg-zed-bg-surface">
              <Show when={activeLane()}>
                {(lane) => (
                  <TerminalView
                    laneId={lane().id}
                    cwd={lane().workingDir}
                    onTerminalReady={(terminalId) => {
                      props.onTerminalReady?.(lane().id, terminalId);
                    }}
                    onTerminalExit={() => {
                      props.onTerminalExit?.(lane().id);
                    }}
                    onAgentFailed={props.onAgentFailed}
                  />
                )}
              </Show>
            </div>
          </div>
            </div>

            {/* Bottom Panel (Terminal Tabs) - Spans full width below Editor + Agent */}
            <For each={Array.from(props.initializedLanes)}>
              {(laneId) => {
                const lane = createMemo(() => props.lanes.find((l) => l.id === laneId));

                return (
                  <Show when={lane() && lane()!.id === props.activeLaneId}>
                    <TabPanel laneId={lane()!.id} workingDir={lane()!.workingDir} />
                  </Show>
                );
              }}
            </For>
          </div>
        </Show>
      </div>

      {/* Status Bar */}
      <StatusBar activeLane={activeLane()} totalLanes={props.lanes.length} />
    </div>
  );
}
