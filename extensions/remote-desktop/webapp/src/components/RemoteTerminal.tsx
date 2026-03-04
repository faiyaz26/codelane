import { onMount, onCleanup } from 'solid-js';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface RemoteTerminalProps {
  terminalId: string;
  onData: (data: string) => void;
  ref?: (methods: { write: (data: string | Uint8Array) => void }) => void;
  initialData?: string;
}

export function RemoteTerminal(props: RemoteTerminalProps) {
  let terminalContainer: HTMLDivElement | undefined;
  let webglAddon: WebglAddon | undefined;
  
  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#000000',
      foreground: '#e6e6e6',
      cursor: '#0b93f6',
      black: '#1a1a1a',
      red: '#f23c3c',
      green: '#26d97f',
      yellow: '#f5c249',
      blue: '#0b93f6',
      magenta: '#b88ef2',
      cyan: '#26d9d9',
      white: '#e6e6e6',
    },
    allowProposedApi: true,
  });

  const fitAddon = new FitAddon();

  onMount(() => {
    if (!terminalContainer) return;

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.loadAddon(new Unicode11Addon());
    terminal.unicode.activeVersion = '11';

    terminal.open(terminalContainer);
    
    // Try to load WebGL for performance
    try {
      webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon could not be loaded, falling back to canvas', e);
    }

    // Fit terminal to container
    setTimeout(() => fitAddon.fit(), 50);

    terminal.onData((data) => {
      props.onData(data);
    });

    if (props.initialData) {
      terminal.write(props.initialData);
    }

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Ignore resize errors during teardown
      }
    };
    window.addEventListener('resize', handleResize);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      
      // Explicitly dispose addons before terminal to avoid WebGL race conditions
      try {
        if (webglAddon) {
          webglAddon.dispose();
        }
        fitAddon.dispose();
        terminal.dispose();
      } catch (e) {
        console.warn('[RemoteTerminal] Error during disposal:', e);
      }
    });
  });

  // Expose methods to parent
  if (props.ref) {
    props.ref({
      write: (data: string | Uint8Array) => terminal.write(data)
    });
  }

  return (
    <div ref={terminalContainer} class="w-full h-full bg-black p-2" />
  );
}
