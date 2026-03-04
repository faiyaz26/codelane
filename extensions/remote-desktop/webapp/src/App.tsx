import { createSignal, Show, onMount } from 'solid-js';
import { Button, TextField } from '@codelane/shared';
import { Peer } from 'peerjs';

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
      // Host ID in URL is often codelane-host-ABCDEF, but user sees ABCDEF
      const displayId = host.startsWith('codelane-host-') ? host.replace('codelane-host-', '') : host;
      setConnectionId(displayId);
    }
    if (pinParam) setPin(pinParam);

    if (host && pinParam) {
      handleConnect();
    }
  });

  const handleConnect = async () => {
    if (!connectionId() || !pin()) return;
    
    setIsLoading(true);
    setError(null);

    const fullHostId = `codelane-host-${connectionId().toUpperCase()}`;
    
    try {
      const newPeer = new Peer();

      newPeer.on('open', () => {
        const connection = newPeer.connect(fullHostId);
        setConn(connection);

        connection.on('open', () => {
          // Send auth packet
          connection.send({ type: 'auth', pin: pin() });
        });

        connection.on('data', (data: any) => {
          if (data.type === 'auth_success') {
            setIsConnected(true);
            setIsLoading(false);
          } else if (data.type === 'error') {
            setError(data.message);
            setIsLoading(false);
            connection.close();
          }
        });

        connection.on('close', () => {
          setIsConnected(false);
          setConn(null);
        });

        connection.on('error', (err) => {
          setError(err.message);
          setIsLoading(false);
        });
      });

      newPeer.on('error', (err) => {
        setError(`PeerJS error: ${err.type}`);
        setIsLoading(false);
      });

    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div class="h-screen w-screen bg-zed-bg-app flex flex-col items-center justify-center p-6">
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

function RemoteDashboard(_props: { conn: any }) {
  return (
    <div class="flex flex-col items-center justify-center text-zed-text-primary">
      <h2 class="text-2xl font-bold mb-4">Dashboard (Phase 2)</h2>
      <p class="text-zed-text-secondary italic">Establishing data stream from Codelane Desktop...</p>
      <Button variant="secondary" onClick={() => window.location.reload()} class="mt-8">
        Disconnect
      </Button>
    </div>
  );
}

export default App;
