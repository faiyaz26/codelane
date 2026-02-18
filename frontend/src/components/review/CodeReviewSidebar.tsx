/**
 * CodeReviewSidebar - Combined file list and agent button
 *
 * Displays:
 * - Top section: List of changed files
 * - Bottom section: Button to start AI agent with review context
 */

import { Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { CodeReviewFileList } from './CodeReviewFileList';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { useCodeReviewTerminal } from '../../hooks/useCodeReviewTerminal';
import { getAgentSettings } from '../../lib/settings-api';

import '@xterm/xterm/css/xterm.css';

interface CodeReviewSidebarProps {
  laneId: string;
  workingDir: string;
}

export function CodeReviewSidebar(props: CodeReviewSidebarProps) {
  const [terminalHeight, setTerminalHeight] = createSignal(250); // Default 250px
  const [isResizing, setIsResizing] = createSignal(false);
  const [terminalContainer, setTerminalContainer] = createSignal<HTMLElement>();
  const [terminalActive, setTerminalActive] = createSignal(false); // User clicked to show terminal
  const [terminalCollapsed, setTerminalCollapsed] = createSignal(false); // Terminal collapsed state
  const [agentName, setAgentName] = createSignal('claude'); // Default agent name

  const reviewState = () => codeReviewStore.getState(props.laneId)();

  // Load agent name from settings
  onMount(async () => {
    try {
      const settings = await getAgentSettings();
      const cmd = settings.defaultAgent.command || 'claude';
      setAgentName(cmd);
    } catch {
      setAgentName('claude');
    }
  });

  // Show terminal when review is ready AND user clicked the button
  const shouldShowTerminal = () => reviewState().status === 'ready' && terminalActive();

  // Terminal lifecycle managed by hook
  const terminal = useCodeReviewTerminal({
    workingDir: props.workingDir,
    enabled: shouldShowTerminal,
    containerRef: terminalContainer,
    autoStartAgent: true, // Auto-start agent with review context
  });

  const handleStartAgent = () => {
    // Set terminal height to half the sidebar height
    const sidebar = document.getElementById('code-review-sidebar');
    if (sidebar) {
      const halfHeight = Math.floor(sidebar.getBoundingClientRect().height / 2);
      setTerminalHeight(halfHeight);
    }
    setTerminalActive(true);
  };

  const handleToggleCollapse = () => {
    setTerminalCollapsed(!terminalCollapsed());
  };

  // Fit terminal on resize
  createEffect(() => {
    if (!isResizing() && terminal.isReady()) {
      terminal.fitTerminal();
    }
  });

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing()) return;
    const sidebar = document.getElementById('code-review-sidebar');
    if (!sidebar) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const newHeight = sidebarRect.bottom - e.clientY;

    // Min 100px, max 60% of sidebar height
    const minHeight = 100;
    const maxHeight = sidebarRect.height * 0.6;

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      setTerminalHeight(newHeight);
      terminal.fitTerminal();
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

  const isReviewReady = () => reviewState().status === 'ready';

  return (
    <div id="code-review-sidebar" class="flex flex-col h-full">
      {/* File List - Top Section */}
      <div
        class="flex-1 overflow-hidden"
        style={{
          height: terminalActive()
            ? terminalCollapsed()
              ? 'calc(100% - 40px)' // Just header height when collapsed
              : `calc(100% - ${terminalHeight()}px)`
            : '100%'
        }}
      >
        <CodeReviewFileList laneId={props.laneId} />
      </div>

      {/* Agent Button or Terminal - Bottom Section */}
      <Show when={isReviewReady()}>
        <Show
          when={terminalActive()}
          fallback={
            <div class="flex-shrink-0 border-t border-zed-border-default p-4 bg-zed-bg-panel">
              <button
                onClick={handleStartAgent}
                class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Ask {agentName()} more about the changes
              </button>
            </div>
          }
        >
          <div
            class="flex-shrink-0 border-t border-zed-border-default flex flex-col bg-zed-bg-panel"
            style={{ height: terminalCollapsed() ? '40px' : `${terminalHeight()}px` }}
          >
            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              class="h-1 bg-zed-border-default hover:bg-zed-accent-blue cursor-ns-resize transition-colors flex-shrink-0"
              classList={{ 'bg-zed-accent-blue': isResizing() }}
              style={{ display: terminalCollapsed() ? 'none' : 'block' }}
            />

            {/* Header */}
            <div class="h-8 flex items-center justify-between px-3 border-b border-zed-border-subtle flex-shrink-0 bg-zed-bg-panel">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span class="text-xs font-medium text-zed-text-primary">AI Assistant</span>
              </div>
              <button
                onClick={handleToggleCollapse}
                class="p-1 hover:bg-zed-bg-hover rounded transition-colors text-zed-text-tertiary hover:text-zed-text-primary"
                title={terminalCollapsed() ? 'Expand' : 'Collapse'}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d={terminalCollapsed() ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                  />
                </svg>
              </button>
            </div>

            {/* Terminal Container */}
            <div
              ref={setTerminalContainer}
              class="flex-1 overflow-hidden"
              style={{ display: terminalCollapsed() ? 'none' : 'block' }}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
}
