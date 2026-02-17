/**
 * CodeReviewAgentPanel - Bottom panel for Code Review tab
 *
 * Shows a dedicated AI agent terminal with review context pre-loaded.
 * No tab management - just a single agent terminal for asking follow-up questions.
 */

import { Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { spawn, type PtyHandle } from '../../services/PortablePty';
import { codeReviewStore } from '../../services/CodeReviewStore';
import { getAgentSettings } from '../../lib/settings-api';

import '@xterm/xterm/css/xterm.css';

interface CodeReviewAgentPanelProps {
  laneId: string;
  workingDir: string;
}

export function CodeReviewAgentPanel(props: CodeReviewAgentPanelProps) {
  const [collapsed, setCollapsed] = createSignal(false); // Start expanded
  const [panelHeight, setPanelHeight] = createSignal(300);
  const [isResizing, setIsResizing] = createSignal(false);
  let terminalRef: HTMLDivElement | undefined;
  let terminal: Terminal | null = null;
  let pty: PtyHandle | null = null;
  let fitAddon: FitAddon | null = null;

  const reviewState = () => codeReviewStore.getState(props.laneId)();
  const [terminalInitialized, setTerminalInitialized] = createSignal(false);
  const [terminalRefReady, setTerminalRefReady] = createSignal(false);

  // Initialize terminal when status becomes ready and terminal ref is available
  createEffect(() => {
    const status = reviewState().status;
    const refReady = terminalRefReady();
    console.log('[CodeReviewAgentPanel] createEffect running, status:', status, 'refReady:', refReady, 'initialized:', terminalInitialized(), 'terminalRef:', !!terminalRef);

    if (status !== 'ready' || !refReady || terminalInitialized()) {
      return;
    }

    console.log('[CodeReviewAgentPanel] All conditions met, initializing terminal...');
    setTerminalInitialized(true);

    if (!terminalRef) {
      console.error('[CodeReviewAgentPanel] terminalRef is null even though refReady is true!');
      return;
    }

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
    console.log('[CodeReviewAgentPanel] Terminal opened and fitted');

    // Spawn PTY with agent (async)
    (async () => {
      try {
        console.log('[CodeReviewAgentPanel] Spawning PTY...');
        pty = await spawn(undefined, undefined, {
        cwd: props.workingDir,
        cols: terminal.cols,
        rows: terminal.rows,
      });

      // Connect terminal to PTY
      terminal.onData((data) => {
        pty?.write(data);
      });

      pty.onData((data) => {
        terminal?.write(data);
      });

      // Send welcome message with user's default agent
      setTimeout(async () => {
        terminal?.writeln('\x1b[1;35m━━━ AI Review Assistant ━━━\x1b[0m');
        terminal?.writeln('');
        terminal?.writeln('\x1b[90mThis terminal is ready for asking questions about your code changes.\x1b[0m');

        // Get user's default agent
        try {
          const settings = await getAgentSettings();
          const agentCmd = settings.defaultAgent.command || 'claude';
          terminal?.writeln(`\x1b[90mStart your AI agent to get assistance:\x1b[0m`);
          terminal?.writeln('');
          terminal?.writeln(`  \x1b[36m${agentCmd}\x1b[0m`);
        } catch {
          terminal?.writeln('\x1b[90mStart an AI agent (claude, aider, etc.) to get assistance.\x1b[0m');
        }
        terminal?.writeln('');
      }, 500);
      } catch (err) {
        terminal?.writeln(`\x1b[31mFailed to spawn terminal: ${err}\x1b[0m`);
      }
    })();

    onCleanup(() => {
      pty?.kill();
      terminal?.dispose();
    });
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
      fitAddon?.fit();
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

  console.log('[CodeReviewAgentPanel] Rendering, status:', status, 'collapsed:', isCollapsed, 'height:', height);

  return (
    <Show
      when={status === 'ready'}
      fallback={
        <div class="h-10 bg-zed-bg-panel border-t border-zed-border-subtle flex items-center px-3 text-xs text-zed-text-tertiary">
          {(() => {
            console.log('[CodeReviewAgentPanel] Showing fallback, status:', status);
            return 'Generate a review to enable AI assistant';
          })()}
        </div>
      }
    >
      {(() => {
        console.log('[CodeReviewAgentPanel] Showing main content, status:', status);
        return null;
      })()}
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
          ref={(el) => {
            terminalRef = el;
            console.log('[CodeReviewAgentPanel] Terminal div ref set:', !!el);
            if (el) setTerminalRefReady(true);
          }}
          class="flex-1 overflow-hidden"
          style={{ display: collapsed() ? 'none' : 'block' }}
        />
      </div>
    </Show>
  );
}
