/**
 * useCodeReviewTerminal - Clean terminal lifecycle hook for code review panel
 *
 * Encapsulates all terminal initialization, PTY spawning, and cleanup logic.
 * Eliminates race conditions and complex state tracking from the component.
 */

import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { spawn, type PtyHandle } from '../services/PortablePty';
import { getAgentSettings } from '../lib/settings-api';

export interface CodeReviewTerminalOptions {
  workingDir: string;
  enabled: boolean; // true when status is 'ready'
  containerRef: Accessor<HTMLElement | undefined>;
}

export interface CodeReviewTerminalReturn {
  isReady: Accessor<boolean>;
  fitTerminal: () => void;
}

export function useCodeReviewTerminal(
  options: CodeReviewTerminalOptions
): CodeReviewTerminalReturn {
  const [isReady, setIsReady] = createSignal(false);

  let terminal: Terminal | null = null;
  let pty: PtyHandle | null = null;
  let fitAddon: FitAddon | null = null;
  let initialized = false;

  // Initialize when enabled and container is ready
  createEffect(() => {
    const container = options.containerRef();
    const enabled = options.enabled;

    if (!enabled || !container || initialized) {
      return;
    }

    initialized = true;
    initializeTerminal(container);
  });

  async function initializeTerminal(container: HTMLElement) {
    // Create terminal
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
    terminal.open(container);
    fitAddon.fit();

    // Spawn PTY
    try {
      pty = await spawn(undefined, undefined, {
        cwd: options.workingDir,
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

      // Send welcome message
      await sendWelcomeMessage(terminal);

      setIsReady(true);
    } catch (err) {
      terminal?.writeln(`\x1b[31mFailed to spawn terminal: ${err}\x1b[0m`);
    }
  }

  async function sendWelcomeMessage(term: Terminal) {
    // Small delay to ensure terminal is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    term.writeln('\x1b[1;35m━━━ AI Review Assistant ━━━\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90mThis terminal is ready for asking questions about your code changes.\x1b[0m');

    try {
      const settings = await getAgentSettings();
      const agentCmd = settings.defaultAgent.command || 'claude';
      term.writeln(`\x1b[90mStart your AI agent to get assistance:\x1b[0m`);
      term.writeln('');
      term.writeln(`  \x1b[36m${agentCmd}\x1b[0m`);
    } catch {
      term.writeln('\x1b[90mStart an AI agent (claude, aider, etc.) to get assistance.\x1b[0m');
    }
    term.writeln('');
  }

  const fitTerminal = () => {
    fitAddon?.fit();
  };

  // Cleanup
  onCleanup(() => {
    pty?.kill();
    terminal?.dispose();
    initialized = false;
  });

  return { isReady, fitTerminal };
}
