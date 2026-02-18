import { Show, Switch, Match, createEffect } from 'solid-js';
import { ActivityView } from './ActivityBar';
import { FileExplorer } from '../explorer/FileExplorer';
import { SearchPanel } from '../search';
import { CodeReviewChanges } from './CodeReviewChanges';
import { CodeReviewSidebar } from '../review/CodeReviewSidebar';
import { editorStateManager } from '../../services/EditorStateManager';
import type { Lane } from '../../types/lane';

interface SidebarProps {
  lane: Lane;
  effectiveWorkingDir: string;
  activeView: ActivityView;
  width: number;
  collapsed: boolean;
  onFileSelect: (path: string | undefined) => void;
  onToggleCollapse: () => void;
}

export function Sidebar(props: SidebarProps) {
  // Get the title for the current view
  const getViewTitle = () => {
    switch (props.activeView) {
      case ActivityView.Explorer:
        return 'Explorer';
      case ActivityView.Search:
        return 'Search';
      case ActivityView.GitManager:
        return 'Git Manager';
      case ActivityView.CodeReview:
        return 'Code Review';
      case ActivityView.Extensions:
        return 'Extensions';
      default:
        return 'Explorer';
    }
  };

  return (
    <Show
      when={!props.collapsed}
      fallback={<CollapsedSidebar onExpand={props.onToggleCollapse} />}
    >
      <div
        class="flex-shrink-0 bg-zed-bg-panel border-l border-zed-border-subtle overflow-hidden flex flex-col"
        style={{ width: `${props.width}px` }}
      >
        {/* Common Sidebar Header */}
        <SidebarHeader title={getViewTitle()} onToggleCollapse={props.onToggleCollapse} />

        {/* Content */}
        <div class="flex-1 overflow-hidden">
          <Switch>
            <Match when={props.activeView === ActivityView.Explorer}>
              <FileExplorer
                laneId={props.lane.id}
                workingDir={props.effectiveWorkingDir}
                onFileSelect={props.onFileSelect}
              />
            </Match>
            <Match when={props.activeView === ActivityView.Search}>
              <SearchPanel
                workingDir={props.effectiveWorkingDir}
                laneId={props.lane.id}
                onFileOpen={(path, line, match) => {
                  editorStateManager.openFileAtLine(props.lane.id, path, line, match);
                }}
              />
            </Match>
          <Match when={props.activeView === ActivityView.GitManager}>
            <CodeReviewChanges
              laneId={props.lane.id}
              workingDir={props.effectiveWorkingDir}
              onFileSelect={(path) => {
                // Open file in editor to show diff
                props.onFileSelect(path);
              }}
            />
          </Match>
          <Match when={props.activeView === ActivityView.CodeReview}>
            <CodeReviewSidebar
              laneId={props.lane.id}
              workingDir={props.effectiveWorkingDir}
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
      </div>
    </Show>
  );
}

// Common sidebar header with collapse button
function SidebarHeader(props: { title: string; onToggleCollapse: () => void }) {
  return (
    <div class="panel-header justify-between">
      <span class="panel-header-title">
        {props.title}
      </span>
      <button
        class="text-zed-text-tertiary hover:text-zed-text-primary transition-colors p-0.5 rounded hover:bg-zed-bg-hover"
        onClick={props.onToggleCollapse}
        title="Collapse sidebar"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
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
