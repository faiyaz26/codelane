/**
 * SharedTerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives a terminal instance and fit addon, and handles rendering and resize.
 */

import { onMount, onCleanup } from 'solid-js';
import { loadAddons, attachKeyHandlers, type TerminalHandlers } from '../terminal/terminal-utils';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

interface SharedTerminalInstanceProps {
  terminal: Terminal;
  fitAddon: FitAddon;
  onWritePty: (data: string) => void;
  onResizePty: (cols: number, rows: number) => void;
  handlers?: TerminalHandlers;
  class?: string;
}

export function SharedTerminalInstance(props: SharedTerminalInstanceProps) {
  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!containerRef) return;

    const { terminal, fitAddon } = props;

    // Open terminal in container
    terminal.open(containerRef);

    // Load rendering + utility addons
    loadAddons(terminal, props.handlers);

    // Attach key handlers for clipboard and compatibility
    const detachKeys = attachKeyHandlers(terminal, props.onWritePty, props.handlers);

    // Fit terminal to container
    const rect = containerRef.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      fitAddon.fit();
    }

    // Focus the terminal
    terminal.focus();

    // Safe fit that guards against zero dimensions and preserves scroll position
    const safeFitAndResize = () => {
      if (!containerRef) return;
      const r = containerRef.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;

      const buffer = terminal.buffer.active;
      const isAtBottom = buffer.baseY + terminal.rows >= buffer.length;

      fitAddon.fit();
      props.onResizePty(terminal.cols, terminal.rows);

      // Force full re-render
      terminal.refresh(0, terminal.rows - 1);

      if (isAtBottom) {
        terminal.scrollToBottom();
      }
    };

    // Initial resize
    setTimeout(() => {
      safeFitAndResize();
      terminal.scrollToBottom();
    }, 100);

    // Handle resize events
    let resizeTimeout: number | undefined;
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(safeFitAndResize, 100) as unknown as number;
    });

    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver?.disconnect();
      detachKeys();
    });
  });

  return (
    <div
      ref={containerRef}
      class={`w-full h-full ${props.class || ''}`}
    />
  );
}
