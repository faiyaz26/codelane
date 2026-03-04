import { 
  SharedTerminalInstance, 
  createTerminal, 
  createFitAddon,
  getTerminalThemeById
} from '@codelane/shared';

interface RemoteTerminalProps {
  terminalId: string;
  onData: (data: string) => void;
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
      onResizePty={(cols, rows) => {
        // In the future, we might want to send resize events back to the desktop
        console.debug(`[RemoteTerminal] Resized to ${cols}x${rows}`);
      }}
      class="bg-black p-2"
    />
  );
}
