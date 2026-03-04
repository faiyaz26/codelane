/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { 
  SharedTerminalInstance, 
  updateTerminalTheme, 
  themeManager 
} from '@codelane/shared';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import type { TerminalHandle } from '../../types/terminal';

interface TerminalInstanceProps {
  handle: TerminalHandle;
}

export function TerminalInstance(props: TerminalInstanceProps) {
  // Watch for theme changes and update terminal
  createEffect(() => {
    themeManager.getTheme()(); // Subscribe to theme changes
    if (props.handle?.terminal) {
      updateTerminalTheme(props.handle.terminal);
    }
  });

  const terminalHandlers = {
    onOpenLink: (uri: string) => {
      shellOpen(uri).catch(console.error);
    },
    onWriteClipboard: async (text: string) => {
      await writeText(text);
    }
  };

  onMount(() => {
    if (!props.handle) return;
    const { terminal } = props.handle;

    // Sticky scroll detection
    const updateAutoScroll = () => {
      const buffer = terminal.buffer.active;
      props.handle.autoScroll = buffer.baseY + terminal.rows >= buffer.length;
    };
    terminal.onScroll(updateAutoScroll);
  });

  return (
    <SharedTerminalInstance
      terminal={props.handle.terminal}
      fitAddon={props.handle.fitAddon}
      onWritePty={(data) => props.handle.pty.write(data)}
      onResizePty={(cols, rows) => props.handle.pty.resize(cols, rows)}
      handlers={terminalHandlers}
      class="bg-zed-bg-panel"
    />
  );
}
