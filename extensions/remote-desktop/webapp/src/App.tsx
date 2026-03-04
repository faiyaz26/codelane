import { createSignal, Show, onMount, For } from 'solid-js';
import { Button, TextField } from '@codelane/shared';
import { Peer } from 'peerjs';
import { RemoteTerminal } from './components/RemoteTerminal';
import { TerminalToolbar } from './components/TerminalToolbar';
import { remoteStore } from './services/RemoteStore';

function App() {
  const [connectionId, setConnectionId] = createSignal('');
  const [pin, setPin] = createSignal('');
  const [isConnecting, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [conn, setConn] = createSignal<any>(null);

  // Auto-fill from URL
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const pinParam = params.get('pin');
    
    if (host) {
      const displayId = host.startsWith('codelane-host-') ? host.replace('codelane-host-', '') : host;
      setConnectionId(displayId);
    }
    if (pinParam) setPin(pinParam);

    if (host && pinParam) {
      handleConnect();
    }
  });

  const handleConnect = async () => {
    const rawId = connectionId().trim().toUpperCase();
    const rawPin = pin().trim();
    
    if (!rawId || !rawPin) return;
    
    setIsLoading(true);
    setError(null);

    const fullHostId = `codelane-host-${rawId}`;
    console.info(`[Remote] Attempting to connect to host: ${fullHostId}`);
    
    try {
      const newPeer = new Peer();

      newPeer.on('open', (id) => {
        console.info(`[Remote] Signaling server connected. My Client ID: ${id}`);
        const connection = newPeer.connect(fullHostId, {
          reliable: true
        });
        setConn(connection);

        connection.on('open', () => {
          console.info('[Remote] P2P Channel open. Sending auth...');
          connection.send({ type: 'auth', pin: rawPin });
        });

        connection.on('data', (data: any) => {
          if (data.type === 'auth_success') {
            console.info('[Remote] Authentication successful!');
            setIsConnected(true);
            setIsLoading(false);
          } else if (data.type === 'error') {
            setError(data.message);
            setIsLoading(false);
            connection.close();
          }
        });

        connection.on('close', () => {
          console.warn('[Remote] Connection closed');
          setIsConnected(false);
          setConn(null);
        });
      });

      newPeer.on('error', (err) => {
        console.error('[Remote] PeerJS Error:', err.type, err.message);
        if (err.type === 'peer-unavailable') {
          setError(`Host "${rawId}" not found. Ensure the Desktop app is hosting.`);
        } else if (err.type === 'network') {
          setError('Network error. Check your internet connection.');
        } else {
          setError(`Connection error: ${err.type}`);
        }
        setIsLoading(false);
        newPeer.destroy();
      });

    } catch (err: any) {
      console.error('[Remote] Catch block error:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div class="h-screen w-screen bg-zed-bg-app flex flex-col items-center justify-center p-6 overflow-hidden">
      <Show when={!isConnected()} fallback={<RemoteDashboard conn={conn()} />}>
        <div class="w-full max-w-md bg-zed-bg-overlay border border-zed-border-default rounded-xl shadow-2xl p-8 flex flex-col animate-slide-down">
          <div class="flex items-center gap-3 mb-8">
            <div class="w-10 h-10 bg-zed-accent-blue rounded-lg flex items-center justify-center text-white">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.828a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-zed-text-primary">CodeLane Remote</h1>
              <p class="text-xs text-zed-text-tertiary">Access your desktop from anywhere</p>
            </div>
          </div>

          <div class="space-y-6">
            <TextField
              label="Connection ID"
              placeholder="e.g. 7X2K9P1M"
              value={connectionId()}
              onChange={setConnectionId}
            />
            <TextField
              label="Handshake PIN"
              placeholder="6-digit code"
              value={pin()}
              onChange={setPin}
              type="password"
            />

            <Show when={error()}>
              <div class="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error()}
              </div>
            </Show>

            <Button
              variant="primary"
              size="lg"
              class="w-full mt-4"
              onClick={handleConnect}
              disabled={isConnecting() || !connectionId() || !pin()}
            >
              {isConnecting() ? 'Connecting...' : 'Connect to Desktop'}
            </Button>
          </div>

          <p class="mt-8 text-center text-[10px] text-zed-text-disabled uppercase tracking-widest">
            End-to-End Encrypted P2P
          </p>
        </div>
      </Show>
    </div>
  );
}

function RemoteDashboard(props: { conn: any }) {
  let terminalRef: { write: (data: string | Uint8Array) => void } | undefined;
  const [commandInput, setCommandInput] = createSignal('');

  onMount(() => {
    // Request lanes list
    props.conn.send({ type: 'lanes:list' });

    // Handle data from desktop
    props.conn.on('data', (data: any) => {
      if (data.type === 'lanes:list_result') {
        remoteStore.setLanes(data.lanes);
        if (data.lanes.length > 0 && !remoteStore.activeLaneId()) {
          handleSelectLane(data.lanes[0].id);
        }
      } else if (data.type === 'terminal:data') {
        // PERF: Handle raw ArrayBuffer directly from PeerJS
        const bytes = new Uint8Array(data.data);
        terminalRef?.write(bytes);
      }
    });
  });

  const handleSelectLane = (laneId: string) => {
    remoteStore.setActiveLaneId(laneId);
    // \x1b[2J = clear screen, \x1b[H = move cursor to top-left
    terminalRef?.write('\x1b[2J\x1b[H');
    props.conn.send({ type: 'terminal:subscribe', terminalId: `${laneId}-agent` });
  };

  const sendToTerminal = (data: string) => {
    const laneId = remoteStore.activeLaneId();
    if (laneId) {
      props.conn.send({ 
        type: 'terminal:write', 
        terminalId: `${laneId}-agent`, 
        data 
      });
    }
  };

  const handleCommandSubmit = (e: Event) => {
    e.preventDefault();
    const cmd = commandInput().trim();
    if (cmd) {
      sendToTerminal(cmd + '\n');
      setCommandInput('');
    }
  };

  return (
    <div class="h-full w-full flex flex-col overflow-hidden">
      {/* Mobile Top Bar */}
      <header class="h-14 border-b border-zed-border-subtle flex items-center justify-between px-4 bg-zed-bg-panel shrink-0">
        <div class="flex items-center gap-2 overflow-hidden">
          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <h1 class="text-sm font-bold truncate">
            {remoteStore.lanes().find(l => l.id === remoteStore.activeLaneId())?.name || 'CodeLane Remote'}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
          Disconnect
        </Button>
      </header>

      {/* Content Area */}
      <main class="flex-1 overflow-hidden relative bg-black text-white font-mono">
        <Show when={remoteStore.activeLaneId()} fallback={
          <div class="h-full flex items-center justify-center text-zed-text-tertiary">
            Select a lane to start
          </div>
        }>
          <RemoteTerminal 
            terminalId={remoteStore.activeLaneId()!} 
            onData={sendToTerminal}
            ref={(r) => terminalRef = r}
          />
        </Show>
      </main>

      {/* Command Input Box */}
      <Show when={remoteStore.activeLaneId()}>
        <form 
          onSubmit={handleCommandSubmit}
          class="px-2 py-2 bg-zed-bg-panel border-t border-zed-border-subtle flex gap-2 items-center shrink-0"
        >
          <input
            type="text"
            value={commandInput()}
            onInput={(e) => setCommandInput(e.currentTarget.value)}
            placeholder="Type command..."
            class="flex-1 bg-zed-bg-surface border border-zed-border-default rounded-md px-3 py-1.5 text-sm text-zed-text-primary focus:outline-none focus:border-zed-accent-blue transition-colors"
            autocapitalize="none"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
          />
          <button 
            type="submit"
            class="p-2 text-zed-accent-blue hover:bg-zed-bg-hover rounded-md transition-colors"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </Show>

      {/* Mobile Developer Toolbar */}
      <Show when={remoteStore.activeLaneId()}>
        <TerminalToolbar onKeyPress={sendToTerminal} />
      </Show>

      {/* Mobile Bottom Navigation / Lane Switcher */}
      <nav class="h-16 border-t border-zed-border-subtle bg-zed-bg-panel flex items-center px-4 gap-3 overflow-x-auto no-scrollbar shrink-0">
        <For each={remoteStore.lanes()}>
          {(lane) => (
            <button
              onClick={() => handleSelectLane(lane.id)}
              class={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                remoteStore.activeLaneId() === lane.id
                  ? 'bg-zed-accent-blue text-white shadow-lg'
                  : 'bg-zed-bg-surface text-zed-text-secondary hover:text-zed-text-primary border border-zed-border-default'
              }`}
            >
              {lane.name}
            </button>
          )}
        </For>
      </nav>
    </div>
  );
}

export default App;
