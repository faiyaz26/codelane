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
  ref?: (methods: { write: (data: string | Uint8Array) => void }) => void;
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
      write: (data: string | Uint8Array) => terminal.write(data)
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
