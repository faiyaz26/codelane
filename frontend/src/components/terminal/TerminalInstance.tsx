/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { ZED_THEME } from '../../theme';
import type { TerminalHandle } from '../../types/terminal';

interface TerminalInstanceProps {
  handle: TerminalHandle;
}

export function TerminalInstance(props: TerminalInstanceProps) {
  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!containerRef) return;

    const { terminal, fitAddon, pty } = props.handle;

    // Open terminal in container
    terminal.open(containerRef);

    // Fit terminal to container
    fitAddon.fit();

    // Focus the terminal
    terminal.focus();

    // Initial resize
    setTimeout(() => {
      fitAddon.fit();
      pty.resize(terminal.cols, terminal.rows);
    }, 100);

    // Handle resize events with debouncing
    let resizeTimeout: number | undefined;
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        pty.resize(terminal.cols, terminal.rows);
      }, 10) as unknown as number;
    });

    resizeObserver.observe(containerRef);

    // Listen for custom terminal resize events
    const handleTerminalResize = () => {
      fitAddon.fit();
      pty.resize(terminal.cols, terminal.rows);
    };
    window.addEventListener('terminal-resize', handleTerminalResize);

    onCleanup(() => {
      resizeObserver?.disconnect();
      window.removeEventListener('terminal-resize', handleTerminalResize);
    });
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
