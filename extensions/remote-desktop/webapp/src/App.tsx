import { createSignal, Show, onMount, For, onCleanup } from 'solid-js';
import { Button, TextField } from '@codelane/shared';
import { Peer } from 'peerjs';
import { RemoteTerminal } from './components/RemoteTerminal';
import { RemoteChatView } from './components/RemoteChatView';
import { TerminalToolbar } from './components/TerminalToolbar';
import { TerminalViewport } from './components/TerminalViewport';
import { remoteStore } from './services/RemoteStore';
import { agentChatParser } from './services/AgentChatParser';

function App() {
  const [connectionId, setConnectionId] = createSignal(localStorage.getItem('cl-remote-id') || '');
  const [pin, setPin] = createSignal(localStorage.getItem('cl-remote-pin') || '');
  const [isConnecting, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [conn, setConn] = createSignal<any>(null);

  // Auto-fill from URL or LocalStorage
  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host');
    const pinParam = params.get('pin');
    
    if (host) {
      const displayId = host.startsWith('codelane-host-') ? host.replace('codelane-host-', '') : host;
      setConnectionId(displayId);
    }
    if (pinParam) setPin(pinParam);

    // If we have credentials (URL or LocalStorage), attempt auto-connect
    if (connectionId() && pin()) {
      handleConnect();
    }
  });

  const handleConnect = async () => {
    const rawId = connectionId().trim().toUpperCase();
    const rawPin = pin().trim();
    
    if (!rawId || !rawPin) return;
    
    setIsLoading(true);
    setError(null);

    // Persist for reloads
    localStorage.setItem('cl-remote-id', rawId);
    localStorage.setItem('cl-remote-pin', rawPin);

    const fullHostId = `codelane-host-${rawId}`;
    console.info(`[Remote] Attempting to connect to host: ${fullHostId}`);
    
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const peerOptions: any = {};
      
      // Optimization: bypass external ICE servers for local testing
      if (isLocal) {
        console.info('[Remote] Localhost detected. Bypassing ICE servers for instant handshake.');
        peerOptions.config = { iceServers: [] };
      }

      const newPeer = new Peer(peerOptions);

      newPeer.on('open', (id) => {
        console.info(`[Remote] Signaling server connected. Client ID: ${id}`);
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
          // Clear storage on failure so we don't loop on bad IDs
          localStorage.removeItem('cl-remote-id');
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

  const handleDisconnect = () => {
    localStorage.removeItem('cl-remote-id');
    localStorage.removeItem('cl-remote-pin');
    window.location.reload();
  };

  return (
    <div class="h-screen w-screen bg-zed-bg-app flex flex-col items-center justify-center p-6 overflow-hidden text-zed-text-primary">
      <Show when={!isConnected()} fallback={<RemoteDashboard conn={conn()} onDisconnect={handleDisconnect} />}>
        <div class="w-full max-w-md bg-zed-bg-overlay border border-zed-border-default rounded-xl shadow-2xl p-8 flex flex-col animate-slide-down">
          <div class="flex items-center gap-3 mb-8">
            <div class="w-10 h-10 bg-zed-accent-blue rounded-lg flex items-center justify-center text-white shadow-lg">
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
              disabled={isConnecting()}
            >
              {isConnecting() ? 'Connecting...' : (localStorage.getItem('cl-remote-id') ? 'Reconnect' : 'Connect to Desktop')}
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

function RemoteDashboard(props: { conn: any, onDisconnect: () => void }) {
  let terminalRef: { 
    write: (data: string | Uint8Array) => void;
    resize: (cols: number, rows: number) => void;
    getBuffer: () => string;
  } | undefined;
  
  const [commandInput, setCommandInput] = createSignal('');
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  const [hostTermSize, setHostTermSize] = createSignal<{ cols: number; rows: number } | undefined>();
  let lastSubscribedId: string | null = null;

  onMount(() => {
    // Request lanes list
    props.conn.send({ type: 'lanes:list' });

    // Polling mechanism to scrape the hidden terminal buffer for clean chat parsing
    const parseInterval = setInterval(() => {
      if (remoteStore.viewMode() === 'chat' && terminalRef && remoteStore.activeLaneId()) {
        const bufferText = terminalRef.getBuffer();
        if (bufferText) {
          agentChatParser.parseBuffer(bufferText);
        }
      }
    }, 500);

    // Handle data from desktop
    props.conn.on('data', (data: any) => {
      if (data.type === 'lanes:list_result') {
        remoteStore.setLanes(data.lanes);
        if (data.lanes.length > 0 && !remoteStore.activeLaneId()) {
          handleSelectLane(data.lanes[0].id);
        }
      } else if (data.type === 'terminal:subscribed') {
        if (data.size) {
          console.info(`[Remote] Subscribed. Locking to host size: ${data.size.cols}x${data.size.rows}`);
          setHostTermSize({ cols: data.size.cols, rows: data.size.rows });
        }
      } else if (data.type === 'terminal:data') {
        if (data.terminalId === `${remoteStore.activeLaneId()}-agent`) {
          const bytes = new Uint8Array(data.data);
          // Always write to background terminal, it's the source of truth for the parser
          terminalRef?.write(bytes);
        }
      }
    });

    onCleanup(() => clearInterval(parseInterval));
  });

  const handleSelectLane = (laneId: string) => {
    const terminalId = `${laneId}-agent`;
    
    if (lastSubscribedId && lastSubscribedId !== terminalId) {
      props.conn.send({ type: 'terminal:unsubscribe', terminalId: lastSubscribedId });
    }

    remoteStore.setActiveLaneId(laneId);
    remoteStore.setMessages([]); // Clear chat for new lane
    agentChatParser.reset();
    lastSubscribedId = terminalId;

    props.conn.send({ type: 'terminal:subscribe', terminalId });
  };

  const handleTerminalResize = (_cols: number, _rows: number) => {
    // Desktop is source of truth
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

  const handleSendWithoutEnter = () => {
    const cmd = commandInput();
    if (cmd) {
      sendToTerminal(cmd);
      remoteStore.addMessage({ role: 'user', content: cmd });
      setCommandInput('');
    }
  };

  const handleCommandSubmit = (e: Event) => {
    e.preventDefault();
    const cmd = commandInput();
    if (cmd) {
      sendToTerminal(cmd + '\n');
      remoteStore.addMessage({ role: 'user', content: cmd });
      setCommandInput('');
    }
  };

  return (
    <div class="h-full w-full flex flex-col overflow-hidden bg-black text-zed-text-primary">
      {/* Mobile Top Bar */}
      <header class="h-12 border-b border-zed-border-subtle flex items-center justify-between px-3 bg-zed-bg-panel shrink-0 z-20">
        <div class="flex items-center gap-2 overflow-hidden">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            class="p-1.5 hover:bg-zed-bg-hover rounded-md text-zed-text-secondary"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Mode Toggle */}
          <div class="flex bg-zed-bg-surface rounded-md p-0.5 border border-zed-border-subtle">
            <button 
              onClick={() => remoteStore.setViewMode('chat')}
              class={`px-2 py-1 text-[9px] font-bold rounded transition-colors ${
                remoteStore.viewMode() === 'chat' ? 'bg-zed-accent-blue text-white' : 'text-zed-text-tertiary'
              }`}
            >CHAT</button>
            <button 
              onClick={() => remoteStore.setViewMode('terminal')}
              class={`px-2 py-1 text-[9px] font-bold rounded transition-colors ${
                remoteStore.viewMode() === 'terminal' ? 'bg-zed-accent-blue text-white' : 'text-zed-text-tertiary'
              }`}
            >TERM</button>
          </div>

          <h1 class="text-[10px] font-bold truncate ml-1 opacity-60">
            {remoteStore.lanes().find(l => l.id === remoteStore.activeLaneId())?.name || 'Remote'}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onDisconnect} class="!h-8 !px-2 !text-[10px]">
          Exit
        </Button>
      </header>

      {/* Main Container */}
      <div class="flex-1 flex overflow-hidden relative">
        {/* Sidebar / Drawer */}
        <div 
          class={`absolute inset-y-0 left-0 w-64 bg-zed-bg-panel border-r border-zed-border-subtle z-30 transform transition-transform duration-300 ease-in-out ${
            isSidebarOpen() ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <div class="p-4 border-b border-zed-border-subtle flex justify-between items-center bg-zed-bg-header">
            <h2 class="text-sm font-bold text-zed-text-primary">Lanes</h2>
            <button onClick={() => setIsSidebarOpen(false)} class="text-zed-text-tertiary">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="overflow-y-auto h-full p-2 flex flex-col gap-1">
            <For each={remoteStore.lanes()}>
              {(lane) => (
                <button
                  onClick={() => {
                    handleSelectLane(lane.id);
                    setIsSidebarOpen(false);
                  }}
                  class={`w-full px-3 py-2.5 rounded-md text-xs font-medium text-left transition-all ${
                    remoteStore.activeLaneId() === lane.id
                      ? 'bg-zed-accent-blue/20 text-zed-accent-blue border-l-2 border-zed-accent-blue'
                      : 'text-zed-text-secondary hover:bg-zed-bg-hover'
                  }`}
                >
                  <div class="truncate font-sans font-semibold">{lane.name}</div>
                  <div class="text-[10px] opacity-50 truncate font-mono">
                    {lane.branch || 'no branch'}
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Backdrop for Sidebar */}
        <Show when={isSidebarOpen()}>
          <div 
            class="absolute inset-0 bg-black/60 backdrop-blur-sm z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        </Show>

        {/* Content Area */}
        <main class="flex-1 overflow-hidden relative flex flex-col bg-black">
          {/* Dual-View Content */}
          <div class="flex-1 overflow-hidden relative">
            <Show when={remoteStore.activeLaneId()} fallback={
              <div class="h-full flex flex-col items-center justify-center text-zed-text-tertiary p-8 text-center">
                <svg class="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-sm">Select a lane from the menu to start controlling your desktop.</p>
                <Button variant="secondary" size="sm" class="mt-4" onClick={() => setIsSidebarOpen(true)}>
                  Open Lanes Menu
                </Button>
              </div>
            }>
              {/* Chat View */}
              <Show when={remoteStore.viewMode() === 'chat'}>
                <RemoteChatView onAction={(val) => {
                  sendToTerminal(val);
                  remoteStore.addMessage({ role: 'user', content: val.trim() || 'Action Selected' });
                }} />
              </Show>

              {/* Raw Terminal View — locked to host dimensions, CSS-scaled to fit mobile */}
              <Show when={remoteStore.viewMode() === 'terminal'}>
                <TerminalViewport hostSize={hostTermSize()}>
                  <For each={[remoteStore.activeLaneId()]}>
                    {(laneId) => (
                      <RemoteTerminal 
                        terminalId={laneId!} 
                        onData={sendToTerminal}
                        onResize={handleTerminalResize}
                        hostSize={hostTermSize()}
                        ref={(r) => terminalRef = r}
                      />
                    )}
                  </For>
                </TerminalViewport>
              </Show>

              {/* Background terminal for parsing always exists */}
              <Show when={remoteStore.viewMode() === 'chat'}>
                <div class="absolute -top-[10000px] left-0 pointer-events-none opacity-0">
                  <For each={[remoteStore.activeLaneId()]}>
                    {(laneId) => (
                      <RemoteTerminal 
                        terminalId={laneId!} 
                        onData={sendToTerminal}
                        onResize={handleTerminalResize}
                        hostSize={hostTermSize()}
                        ref={(r) => terminalRef = r}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>

          {/* Input & Toolbar stuck to bottom of main area */}
          <Show when={remoteStore.activeLaneId()}>
            <div class="shrink-0">
              <form 
                onSubmit={handleCommandSubmit}
                class="px-2 py-2 bg-zed-bg-panel border-t border-zed-border-subtle flex gap-2 items-center"
              >
                <input
                  type="text"
                  value={commandInput()}
                  onInput={(e) => setCommandInput(e.currentTarget.value)}
                  placeholder="Type command..."
                  class="flex-1 bg-zed-bg-surface border border-zed-border-default rounded-md px-3 py-1.5 text-sm text-zed-text-primary focus:outline-none focus:border-zed-accent-blue transition-all shadow-inner"
                  autocapitalize="none"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck={false}
                />
                
                <div class="flex gap-1">
                  <button 
                    type="button"
                    onClick={handleSendWithoutEnter}
                    class="p-2 text-zed-text-secondary hover:text-zed-text-primary hover:bg-zed-bg-hover rounded-md transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  
                  <button 
                    type="submit"
                    class="p-2 text-zed-accent-blue hover:bg-zed-bg-hover rounded-md transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              <TerminalToolbar onKeyPress={sendToTerminal} />
            </div>
          </Show>
        </main>
      </div>
    </div>
  );
}

export default App;
