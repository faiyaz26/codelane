import { createEffect, onCleanup, onMount } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { spawn, type Pty } from 'tauri-pty';
import { ZED_THEME } from '../theme';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  cwd?: string;
  onTerminalReady?: (pid: number) => void;
  onTerminalExit?: () => void;
}

export function TerminalView(props: TerminalViewProps) {
  let containerRef: HTMLDivElement | undefined;
  let terminal: Terminal | undefined;
  let fitAddon: FitAddon | undefined;
  let pty: Pty | undefined;

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

    // Focus the terminal
    terminal.focus();

    try {
      // Spawn PTY with shell
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'zsh';
      const args = process.platform === 'win32' ? [] : ['-l', '-i'];

      console.log('Spawning shell:', shell, 'in directory:', props.cwd);

      pty = await spawn(shell, args, {
        cols: terminal.cols,
        rows: terminal.rows,
        cwd: props.cwd,
      });

      console.log('PTY spawned with PID:', pty.pid);

      // Bidirectional data flow
      pty.onData((data) => {
        if (terminal) {
          terminal.write(data);
        }
      });

      terminal.onData((data) => {
        if (pty) {
          pty.write(data);
        }
      });

      // Handle PTY exit
      pty.onExit(() => {
        console.log('PTY exited');
        if (terminal) {
          terminal.write('\r\n\x1b[1;33m[Process exited]\x1b[0m\r\n');
        }
        props.onTerminalExit?.();
      });

      // Call ready callback
      props.onTerminalReady?.(pty.pid);

      // Handle resize events
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddon && terminal && pty) {
          fitAddon.fit();
          pty.resize(terminal.cols, terminal.rows);
        }
      });

      if (containerRef) {
        resizeObserver.observe(containerRef);
      }

      // Initial resize
      setTimeout(() => {
        if (fitAddon && terminal && pty) {
          fitAddon.fit();
          pty.resize(terminal.cols, terminal.rows);
        }
      }, 100);

      // Cleanup
      onCleanup(() => {
        resizeObserver.disconnect();
      });
    } catch (error) {
      console.error('Failed to create PTY:', error);
      if (terminal) {
        terminal.write('\r\n\x1b[1;31mFailed to create terminal:\x1b[0m ' + error + '\r\n');
      }
    }
  });

  // Cleanup on unmount
  onCleanup(async () => {
    if (pty) {
      try {
        await pty.kill();
        console.log('PTY killed');
      } catch (error) {
        console.error('Failed to kill PTY:', error);
      }
    }

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
