import { 
  SharedTerminalInstance, 
  createTerminal, 
  createFitAddon,
  getTerminalThemeById
} from '@codelane/shared';

interface RemoteTerminalProps {
  terminalId: string;
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  ref?: (methods: { 
    write: (data: string | Uint8Array) => void;
    resize: (cols: number, rows: number) => void;
    getBuffer: () => string;
  }) => void;
  initialData?: string;
}

export function RemoteTerminal(props: RemoteTerminalProps) {
  // Create terminal and fit addon using shared utilities
  // Use a very dark theme for the web app by default
  const terminal = createTerminal(getTerminalThemeById('dark'));
  
  const fitAddon = createFitAddon(terminal);

  // Expose methods to parent
  if (props.ref) {
    props.ref({
      write: (data: string | Uint8Array) => terminal.write(data),
      resize: (cols: number, rows: number) => {
        terminal.resize(cols, rows);
        fitAddon.fit();
      },
      getBuffer: () => {
        const buffer = terminal.buffer.active;
        let text = '';
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            text += line.translateToString(true) + '\n';
          }
        }
        return text;
      }
    });
  }

  return (
    <SharedTerminalInstance
      terminal={terminal}
      fitAddon={fitAddon}
      onWritePty={props.onData}
      onResizePty={props.onResize}
      class="bg-black p-2"
    />
  );
}
