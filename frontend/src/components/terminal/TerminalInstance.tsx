/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { themeManager } from '../../services/ThemeManager';
import { updateTerminalTheme, loadAddons } from '../../lib/terminal-utils';
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

    // Load rendering + utility addons (must be after open() for WebGL)
    loadAddons(terminal);

    // Fit terminal to container (only if container has dimensions)
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
      pty.resize(terminal.cols, terminal.rows);

      // Force full re-render to clear any stale WebGL texture artifacts
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

    // Handle resize events with debouncing
    let resizeTimeout: number | undefined;
    resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(safeFitAndResize, 100) as unknown as number;
    });

    resizeObserver.observe(containerRef);

    // Listen for custom terminal resize events
    const handleTerminalResize = () => safeFitAndResize();
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
