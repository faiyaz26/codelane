/**
 * CodeReviewAgentPanel - Bottom panel for Code Review tab
 *
 * Shows a dedicated AI agent terminal with review context pre-loaded.
 * No tab management - just a single agent terminal for asking follow-up questions.
 */

import { Show, createSignal, createEffect, onMount } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { PortablePty } from '../../services/PortablePty';
import { codeReviewStore } from '../../services/CodeReviewStore';

interface CodeReviewAgentPanelProps {
  laneId: string;
  workingDir: string;
}

export function CodeReviewAgentPanel(props: CodeReviewAgentPanelProps) {
  const [collapsed, setCollapsed] = createSignal(true);
  const [panelHeight, setPanelHeight] = createSignal(300);
  const [isResizing, setIsResizing] = createSignal(false);
  let terminalRef: HTMLDivElement | undefined;
  let terminal: Terminal | null = null;
  let pty: PortablePty | null = null;
  let fitAddon: FitAddon | null = null;

  const reviewState = () => codeReviewStore.getState(props.laneId)();

  // Initialize terminal when panel expands
  createEffect(() => {
    if (!collapsed() && terminalRef && !terminal) {
      initializeTerminal();
    }
  });

  const initializeTerminal = async () => {
    if (!terminalRef) return;

    terminal = new Terminal({
      theme: {
        background: '#111111',
        foreground: '#e6e6e6',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef);
    fitAddon.fit();

    // Create PTY for the agent
    pty = new PortablePty(props.laneId, props.workingDir);
    await pty.spawn();

    // Connect terminal to PTY
    terminal.onData((data) => {
      pty?.write(data);
    });

    pty.onData((data) => {
      terminal?.write(data);
    });

    // Send initial context message
    const context = codeReviewStore.getReviewContext(props.laneId);
    if (context) {
      // Give agent the review context as initial context
      setTimeout(() => {
        pty?.write(`# Code Review Context\n\n${context}\n\n# Ask your questions about the code changes:\n`);
      }, 500);
    }
  };

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
      fitAddon?.fit();
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      pty?.kill();
      terminal?.dispose();
    };
  });

  return (
    <Show
      when={reviewState().status === 'ready'}
      fallback={
        <div class="h-10 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-3 text-xs text-zed-text-tertiary">
          Generate a review to enable AI assistant
        </div>
      }
    >
      <div
        class="bg-zed-bg-panel border-t border-zed-border-subtle flex flex-col"
        style={{ height: collapsed() ? '40px' : `${panelHeight()}px` }}
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
        <Show when={!collapsed()}>
          <div
            onMouseDown={handleMouseDown}
            class="h-1 bg-zed-border-default hover:bg-zed-accent-blue cursor-ns-resize flex-shrink-0 transition-colors"
            classList={{ 'bg-zed-accent-blue': isResizing() }}
          />
        </Show>

        {/* Terminal */}
        <Show when={!collapsed()}>
          <div ref={terminalRef} class="flex-1 overflow-hidden" />
        </Show>
      </div>
    </Show>
  );
}
