/**
 * CodeReviewAgentPanel - Bottom panel for Code Review tab
 *
 * Shows a dedicated AI agent terminal with review context pre-loaded.
 * No tab management - just a single agent terminal for asking follow-up questions.
 */

import { Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { useCodeReviewTerminal } from '../../hooks/useCodeReviewTerminal';

import '@xterm/xterm/css/xterm.css';

interface CodeReviewAgentPanelProps {
  laneId: string;
  workingDir: string;
}

export function CodeReviewAgentPanel(props: CodeReviewAgentPanelProps) {
  const [collapsed, setCollapsed] = createSignal(false); // Start expanded
  const [panelHeight, setPanelHeight] = createSignal(300);
  const [isResizing, setIsResizing] = createSignal(false);
  const [terminalContainer, setTerminalContainer] = createSignal<HTMLElement>();

  const reviewState = () => codeReviewStore.getState(props.laneId)();

  // Terminal lifecycle managed by hook
  const terminal = useCodeReviewTerminal({
    workingDir: props.workingDir,
    enabled: reviewState().status === 'ready',
    containerRef: terminalContainer,
  });

  // Fit terminal on resize (when not actively resizing)
  createEffect(() => {
    if (!isResizing() && terminal.isReady()) {
      terminal.fitTerminal();
    }
  });

  const handleCollapse = () => {
    setCollapsed(!collapsed());
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing()) return;
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight >= 40 && newHeight <= window.innerHeight * 0.5) {
      setPanelHeight(newHeight);
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

  const status = reviewState().status;
  const isCollapsed = collapsed();
  const height = panelHeight();

  return (
    <Show
      when={status === 'ready'}
      fallback={
        <div class="h-10 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-3 text-xs text-zed-text-tertiary">
          Generate a review to enable AI assistant
        </div>
      }
    >
      <div
        class="bg-zed-bg-panel border-t border-zed-border-subtle flex flex-col"
        style={{ height: isCollapsed ? '40px' : `${height}px` }}
      >
        {/* Header with collapse button */}
        <div class="h-10 flex items-center justify-between px-3 border-b border-zed-border-subtle flex-shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span class="text-xs font-medium text-zed-text-primary">AI Review Assistant</span>
          </div>
          <button
            onClick={handleCollapse}
            class="p-1 hover:bg-zed-bg-hover rounded transition-colors text-zed-text-tertiary hover:text-zed-text-primary"
            title={collapsed() ? 'Expand' : 'Collapse'}
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={collapsed() ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
          </button>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          class="h-1 bg-zed-border-default hover:bg-zed-accent-blue cursor-ns-resize flex-shrink-0 transition-colors"
          classList={{ 'bg-zed-accent-blue': isResizing() }}
          style={{ display: collapsed() ? 'none' : 'block' }}
        />

        {/* Terminal */}
        <div
          ref={setTerminalContainer}
          class="flex-1 overflow-hidden"
          style={{ display: collapsed() ? 'none' : 'block' }}
        />
      </div>
    </Show>
  );
}
