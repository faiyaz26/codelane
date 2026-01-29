import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ZED_THEME } from '../theme';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  id?: string;
  shell?: string;
  cwd?: string;
  onTerminalReady?: (terminalId: string) => void;
  onTerminalExit?: (terminalId: string, code?: number) => void;
}

interface TerminalOutputPayload {
  id: string;
  data: string;
}

interface TerminalExitPayload {
  id: string;
  code?: number;
}

export function TerminalView(props: TerminalViewProps) {
  let containerRef: HTMLDivElement | undefined;
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let unlistenOutput: UnlistenFn | undefined;
  let unlistenExit: UnlistenFn | undefined;

  const [terminalId, setTerminalId] = createSignal<string | null>(props.id || null);
  const [isReady, setIsReady] = createSignal(false);

  onMount(async () => {
    if (!containerRef) return;

    // Create xterm.js instance with Zed theme
    terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      allowTransparency: true,
      theme: {
        background: ZED_THEME.bg.panel,
        foreground: ZED_THEME.text.primary,
        cursor: ZED_THEME.accent.blue,
        cursorAccent: ZED_THEME.bg.panel,
        selectionBackground: ZED_THEME.bg.active,
        selectionForeground: ZED_THEME.text.primary,

        // ANSI colors (normal)
        black: ZED_THEME.terminal.black,
        red: ZED_THEME.terminal.red,
        green: ZED_THEME.terminal.green,
        yellow: ZED_THEME.terminal.yellow,
        blue: ZED_THEME.terminal.blue,
        magenta: ZED_THEME.terminal.magenta,
        cyan: ZED_THEME.terminal.cyan,
        white: ZED_THEME.terminal.white,

        // ANSI colors (bright)
        brightBlack: ZED_THEME.terminal.brightBlack,
        brightRed: ZED_THEME.terminal.brightRed,
        brightGreen: ZED_THEME.terminal.brightGreen,
        brightYellow: ZED_THEME.terminal.brightYellow,
        brightBlue: ZED_THEME.terminal.brightBlue,
        brightMagenta: ZED_THEME.terminal.brightMagenta,
        brightCyan: ZED_THEME.terminal.brightCyan,
        brightWhite: ZED_THEME.terminal.brightWhite,
      },
      scrollback: 10000,
      convertEol: false,
      windowsMode: false,
    });

    // Add FitAddon for auto-sizing
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Add WebLinksAddon for clickable links
    const webLinksAddon = new WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    // Open terminal in the container
    terminal.open(containerRef);

    // Fit terminal to container
    fitAddon.fit();

    // Create or use existing terminal ID
    const existingId = terminalId();
    if (!existingId) {
      try {
        const id = await invoke<string>('create_terminal', {
          shell: props.shell,
          cwd: props.cwd,
        });

        setTerminalId(id);
        setIsReady(true);

        // Call callback if provided
        props.onTerminalReady?.(id);

        console.log(`Terminal created with ID: ${id}`);
      } catch (error) {
        console.error('Failed to create terminal:', error);
        terminal.write('\r\n\x1b[1;31mFailed to create terminal:\x1b[0m ' + error + '\r\n');
        return;
      }
    } else {
      setIsReady(true);
    }
  });

  // Listen to terminal output and handle keyboard input
  createEffect(() => {
    const id = terminalId();
    if (!id || !terminal || !isReady()) return;

    // Listen to terminal output events
    const setupOutputListener = async () => {
      unlistenOutput = await listen<TerminalOutputPayload>(
        'terminal-output',
        (event) => {
          if (event.payload.id === id && terminal) {
            terminal.write(event.payload.data);
          }
        }
      );
    };

    // Listen to terminal exit events
    const setupExitListener = async () => {
      unlistenExit = await listen<TerminalExitPayload>(
        'terminal-exit',
        (event) => {
          if (event.payload.id === id && terminal) {
            terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');

            // Call callback if provided
            props.onTerminalExit?.(event.payload.id, event.payload.code);
          }
        }
      );
    };

    setupOutputListener();
    setupExitListener();

    // Handle keyboard input from xterm.js
    const disposable = terminal.onData(async (data) => {
      if (!id) return;

      try {
        await invoke('write_terminal', {
          id,
          data,
        });
      } catch (error) {
        console.error('Failed to write to terminal:', error);
      }
    });

    // Handle resize events
    const handleResize = () => {
      if (!fitAddon || !terminal || !id) return;

      fitAddon.fit();

      // Notify backend of new size
      invoke('resize_terminal', {
        id,
        cols: terminal.cols,
        rows: terminal.rows,
      }).catch((error) => {
        console.error('Failed to resize terminal:', error);
      });
    };

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef) {
      resizeObserver.observe(containerRef);
    }

    // Initial resize
    setTimeout(handleResize, 100);

    // Cleanup
    onCleanup(() => {
      disposable.dispose();
      resizeObserver.disconnect();
    });
  });

  // Cleanup on unmount
  onCleanup(async () => {
    // Unlisten from events
    if (unlistenOutput) {
      unlistenOutput();
    }
    if (unlistenExit) {
      unlistenExit();
    }

    // Close terminal on backend
    const id = terminalId();
    if (id) {
      try {
        await invoke('close_terminal', { id });
        console.log(`Terminal ${id} closed`);
      } catch (error) {
        console.error('Failed to close terminal:', error);
      }
    }

    // Dispose xterm.js instance
    if (terminal) {
      terminal.dispose();
    }
  });

  return (
    <div
      ref={containerRef}
      class="w-full h-full"
      style={{
        background: ZED_THEME.bg.panel,
      }}
    />
  );
}
