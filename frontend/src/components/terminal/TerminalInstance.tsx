/**
 * TerminalInstance - Pure rendering component for xterm.js terminals
 *
 * Receives an existing TerminalHandle and renders it. No lifecycle management.
 */

import { onMount, onCleanup, createEffect } from 'solid-js';
import { 
  SharedTerminalInstance, 
  isTerminalViewportAtBottom,
  updateTerminalTheme, 
  themeManager 
} from '@codelane/shared';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { homeDir } from '@tauri-apps/api/path';
import type { TerminalHandle } from '../../types/terminal';
import { editorStateManager } from '../../services/EditorStateManager';

// Cache the home directory path so we can expand "~" in file links
let cachedHomeDir: string | null = null;
homeDir().then((d) => { cachedHomeDir = d; }).catch(() => {});

interface TerminalInstanceProps {
  handle: TerminalHandle;
  laneId?: string;
  workingDir?: string;
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
    onOpenFile: (path: string, line?: number, column?: number) => {
      const laneId = props.laneId;
      if (!laneId) return;
      // Expand ~ to the cached home directory if available
      const resolvedPath =
        path.startsWith('~/') && cachedHomeDir
          ? cachedHomeDir.replace(/\/$/, '') + path.slice(1)
          : path;
      if (line !== undefined) {
        editorStateManager.openFileAtLine(laneId, resolvedPath, line, undefined).catch(console.error);
      } else {
        editorStateManager.openFile(laneId, resolvedPath).catch(console.error);
      }
      void column; // column reserved for future use (scroll-to-col)
    },
    onWriteClipboard: async (text: string) => {
      await writeText(text);
    }
  };

  onMount(() => {
    if (!props.handle) return;
    const { terminal } = props.handle;

    const setAutoScroll = (autoScroll: boolean) => {
      props.handle.autoScroll = autoScroll;
    };

    // Sticky scroll detection
    const updateAutoScroll = (viewportY = terminal.buffer.active.viewportY) => {
      const autoScroll = isTerminalViewportAtBottom(terminal, viewportY);
      setAutoScroll(autoScroll);
    };

    // Pause follow-mode as soon as the user starts scrolling up so live output
    // cannot race the viewport back to the bottom before xterm emits onScroll.
    terminal.attachCustomWheelEventHandler((event) => {
      if (event.deltaY < 0 && props.handle.autoScroll) {
        setAutoScroll(false);
      }
      return true;
    });

    const scrollDisposable = terminal.onScroll((viewportY) => updateAutoScroll(viewportY));
    updateAutoScroll();
    onCleanup(() => scrollDisposable.dispose());
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
