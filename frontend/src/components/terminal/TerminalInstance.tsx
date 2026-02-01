/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { themeManager } from '../../services/ThemeManager';
import { updateTerminalTheme } from '../../lib/terminal-utils';
import type { TerminalHandle } from '../../types/terminal';

interface TerminalInstanceProps {
  handle: TerminalHandle;
}

export function TerminalInstance(props: TerminalInstanceProps) {
  let containerRef: HTMLDivElement | undefined;
  let resizeObserver: ResizeObserver | undefined;

  // Watch for theme changes and update terminal
  createEffect(() => {
    const currentTheme = themeManager.getTheme()(); // Subscribe to theme changes
    if (props.handle?.terminal) {
      updateTerminalTheme(props.handle.terminal);
    }
  });

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
      // Scroll to bottom after a brief delay to ensure terminal has updated
      setTimeout(() => terminal.scrollToBottom(), 50);
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
      }, 100) as unknown as number;
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
      class="w-full h-full bg-zed-bg-panel"
    />
  );
}
