import { Show, Switch, Match } from 'solid-js';
import { ActivityView } from './ActivityBar';
import { FileExplorer } from '../explorer/FileExplorer';
import { SearchPanel } from '../search';
import { editorStateManager } from '../../services/EditorStateManager';
import type { Lane } from '../../types/lane';

interface SidebarProps {
  lane: Lane;
  activeView: ActivityView;
  width: number;
  collapsed: boolean;
  onFileSelect: (path: string | undefined) => void;
  onToggleCollapse: () => void;
}

export function Sidebar(props: SidebarProps) {
  // Capture lane data to avoid stale accessor issues
  const laneId = props.lane.id;
  const workingDir = props.lane.workingDir;

  return (
    <Show
      when={!props.collapsed}
      fallback={<CollapsedSidebar onExpand={props.onToggleCollapse} />}
    >
      <div
        class="flex-shrink-0 bg-zed-bg-panel border-l border-zed-border-subtle overflow-hidden"
        style={{ width: `${props.width}px` }}
      >
        <Switch>
          <Match when={props.activeView === ActivityView.Explorer}>
            <FileExplorer
              workingDir={workingDir}
              onFileSelect={props.onFileSelect}
              collapsed={props.collapsed}
              onToggleCollapse={props.onToggleCollapse}
            />
          </Match>
          <Match when={props.activeView === ActivityView.Search}>
            <SearchPanel
              workingDir={workingDir}
              laneId={laneId}
              onFileOpen={(path, line, match) => {
                editorStateManager.openFileAtLine(laneId, path, line, match);
              }}
            />
          </Match>
          <Match when={props.activeView === ActivityView.Git}>
            <PlaceholderView
              icon={
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              }
              message="Source Control coming soon"
            />
          </Match>
          <Match when={props.activeView === ActivityView.Extensions}>
            <PlaceholderView
              icon={
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              }
              message="Extensions coming soon"
            />
          </Match>
        </Switch>
      </div>
    </Show>
  );
}

interface CollapsedSidebarProps {
  onExpand: () => void;
}

function CollapsedSidebar(props: CollapsedSidebarProps) {
  return (
    <div class="w-6 flex flex-col bg-zed-bg-panel border-l border-zed-border-subtle">
      <div class="h-10 flex items-center justify-center">
        <button
          class="p-1 text-zed-text-tertiary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded transition-colors"
          onClick={props.onExpand}
          title="Expand explorer"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface PlaceholderViewProps {
  icon: any;
  message: string;
}

function PlaceholderView(props: PlaceholderViewProps) {
  return (
    <div class="p-4 text-center text-zed-text-tertiary text-sm">
      <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {props.icon}
      </svg>
      {props.message}
    </div>
  );
}
