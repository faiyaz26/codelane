/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { WebglAddon } from '@xterm/addon-webgl';
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

    // Add WebGL renderer for better performance
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
    } catch (e) {
      console.warn('WebGL renderer not available, using canvas fallback');
    }

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
      class="w-full h-full"
      style={{
        background: ZED_THEME.bg.panel,
      }}
    />
  );
}
