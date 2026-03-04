// Logic for testability
const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();
const generatePeerId = () => `codelane-host-${Math.random().toString(36).substring(2, 10)}`;

async function handleRemoteData(data, context, state, conn) {
  if (!state.authenticated) {
    if (data.type === 'auth' && data.pin === state.pin) {
      state.authenticated = true;
      state.activeConnection = conn;
      state.setConnected(true);
      
      // Notify the hosting UI
      if (state.onAuthenticated) state.onAuthenticated();
      
      conn.send({ type: 'auth_success' });
      return true;
    } else {
      conn.send({ type: 'error', message: 'Invalid PIN' });
      setTimeout(() => conn.close(), 500);
      return false;
    }
  }

  // Bi-directional Data Hooks
  try {
    if (data.type === 'terminal:list') {
      const ids = context.terminal.getActiveIds();
      conn.send({ type: 'terminal:list_result', ids });
    } 
    else if (data.type === 'terminal:subscribe' && data.terminalId) {
      if (state.activeTerminalListeners[data.terminalId]) return;
      
      const unlisten = await context.terminal.onData(data.terminalId, (chunk) => {
        // PERF: Send raw ArrayBuffer to avoid freezing the main thread with Array.from()
        conn.send({ 
          type: 'terminal:data', 
          terminalId: data.terminalId, 
          data: chunk.buffer 
        });
      });
      
      if (unlisten) {
        state.activeTerminalListeners[data.terminalId] = unlisten;
        conn.send({ type: 'terminal:subscribed', terminalId: data.terminalId });
      }
    }
    else if (data.type === 'terminal:unsubscribe' && data.terminalId) {
      const unlisten = state.activeTerminalListeners[data.terminalId];
      if (unlisten) {
        unlisten();
        delete state.activeTerminalListeners[data.terminalId];
      }
    }
    else if (data.type === 'terminal:write' && data.terminalId && data.data) {
      await context.terminal.write(data.terminalId, data.data);
    }
    else if (data.type === 'lanes:list') {
      const lanes = await context.lanes.list();
      conn.send({ type: 'lanes:list_result', lanes });
    }
    else if (data.type === 'review:get' && data.laneId) {
      const reviewState = context.review.getState(data.laneId);
      conn.send({ type: 'review:state', laneId: data.laneId, state: reviewState });
    }
  } catch (err) {
    console.error('[RemoteDesktop] Error processing remote command:', err);
    conn.send({ type: 'error', message: err.message });
  }
}

function activate(context) {
  // Lazy load PeerJS from CDN
  const loadDependency = (url) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const initializeExtension = async () => {
    try {
      if (!window.Peer) {
        console.info("[RemoteDesktop] Loading PeerJS...");
        await loadDependency('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js');
      }
      
      console.info("[RemoteDesktop] PeerJS loaded successfully");
      startExtensionLogic();
    } catch (err) {
      console.error("[RemoteDesktop] Failed to load PeerJS:", err);
    }
  };

  const state = {
    isConnected: false,
    authenticated: false,
    pin: '',
    lastConnectionId: '', // Persist ID for reuse
    activeConnection: null,
    activeTerminalListeners: {},
    listeners: [],
    onAuthenticated: null, 
    setConnected: (val) => {
      state.isConnected = val;
      state.listeners.forEach(l => l());
    }
  };

  const cleanupListeners = () => {
    Object.values(state.activeTerminalListeners).forEach(unlisten => {
      if (typeof unlisten === 'function') unlisten();
    });
    state.activeTerminalListeners = {};
  };

  const createModalContent = () => {
    const content = document.createElement('div');
    content.className = 'flex flex-col items-center w-full';
    
    // QR Code Container
    const qrContainer = document.createElement('div');
    qrContainer.className = 'bg-white p-3 rounded-xl shadow-inner mb-6 flex items-center justify-center transition-opacity duration-500';
    
    const qrImage = document.createElement('img');
    qrImage.className = 'w-[180px] h-[180px]';
    qrImage.alt = 'Connecting QR Code';
    qrContainer.appendChild(qrImage);

    // Connected Notification
    const statusToast = document.createElement('div');
    statusToast.className = 'hidden flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full mb-6 animate-pulse';
    statusToast.innerHTML = '<div class="w-2 h-2 rounded-full bg-green-500"></div><span class="text-xs font-bold text-green-400">Client Connected</span>';
    
    if (state.isConnected) {
      statusToast.classList.remove('hidden');
      qrContainer.classList.add('opacity-20');
    }

    // ID and PIN Container
    const infoGrid = document.createElement('div');
    infoGrid.className = 'grid grid-cols-2 gap-4 w-full mb-8';

    // Connection ID
    const idWrapper = document.createElement('div');
    idWrapper.className = 'flex flex-col items-center';
    const idLabel = document.createElement('span');
    idLabel.className = 'text-[10px] font-bold text-zed-text-disabled uppercase tracking-widest mb-2';
    idLabel.innerText = 'Connection ID';
    const idContainer = document.createElement('div');
    idContainer.className = 'bg-zed-bg-surface border border-zed-border-default rounded-lg px-3 py-2 flex items-center justify-center w-full';
    const idText = document.createElement('span');
    idText.className = 'text-xl font-mono font-bold text-zed-text-primary';
    idContainer.appendChild(idText);
    idWrapper.appendChild(idLabel);
    idWrapper.appendChild(idContainer);

    // PIN
    const pinWrapper = document.createElement('div');
    pinWrapper.className = 'flex flex-col items-center';
    const pinLabel = document.createElement('span');
    pinLabel.className = 'text-[10px] font-bold text-zed-text-disabled uppercase tracking-widest mb-2';
    pinLabel.innerText = 'Handshake PIN';
    const pinContainer = document.createElement('div');
    pinContainer.className = 'bg-zed-bg-surface border border-zed-border-default rounded-lg px-3 py-2 flex items-center justify-center w-full';
    const pinText = document.createElement('span');
    pinText.className = 'text-xl font-mono font-bold text-zed-accent-blue';
    pinContainer.appendChild(pinText);
    pinWrapper.appendChild(pinLabel);
    pinWrapper.appendChild(pinContainer);

    infoGrid.appendChild(idWrapper);
    infoGrid.appendChild(pinWrapper);
    
    const actionArea = document.createElement('div');
    actionArea.className = 'flex gap-3 w-full';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'flex-1 h-10 inline-flex items-center justify-center rounded-md font-medium transition-colors bg-zed-bg-surface hover:bg-zed-bg-hover border border-zed-border-default text-zed-text-primary text-sm';
    closeBtn.innerText = 'Close';
    closeBtn.onclick = () => context.closeDialog();

    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = 'flex-1 h-10 inline-flex items-center justify-center rounded-md font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm';
    disconnectBtn.innerText = state.isConnected ? 'Disconnect' : 'Stop Hosting';
    disconnectBtn.onclick = () => {
      const msg = state.isConnected 
        ? 'Disconnect remote client? You can reuse the same ID to reconnect later.' 
        : 'Stop hosting? This will clear the Connection ID and PIN.';
        
      if (confirm(msg)) {
        if (state.activeConnection) state.activeConnection.close();
        
        // If they want to stop hosting entirely, kill the peer
        if (!state.isConnected) {
          if (peer) peer.destroy();
          peer = null;
          state.lastConnectionId = '';
          state.pin = '';
        }
        
        state.setConnected(false);
        context.closeDialog();
      }
    };

    actionArea.appendChild(closeBtn);
    actionArea.appendChild(disconnectBtn);
    
    content.appendChild(qrContainer);
    content.appendChild(statusToast);
    content.appendChild(infoGrid);
    content.appendChild(actionArea);
    
    return { content, qrImage, idText, pinText, statusToast, qrContainer };
  };

  let peer = null;

  const startHosting = async () => {
    // If peer exists and not destroyed, just show the dialog with current info
    if (peer && !peer.destroyed) {
      const { content, qrImage, idText, pinText, statusToast, qrContainer } = createModalContent();
      
      context.openDialog({
        title: 'Remote Desktop Info',
        description: 'Hosting is active. Use these details to connect or reconnect a client.',
        size: 'sm',
        component: content
      });

      idText.innerText = state.lastConnectionId;
      pinText.innerText = state.pin;
      
      const url = `https://remote.codelane.app/?host=codelane-host-${state.lastConnectionId}&pin=${state.pin}`;
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

      state.onAuthenticated = () => {
        statusToast.classList.remove('hidden');
        qrContainer.classList.add('opacity-20');
      };
      return;
    }

    const settings = await context.getSettings();
    const { content, qrImage, idText, pinText, statusToast, qrContainer } = createModalContent();
    
    context.openDialog({
      title: 'Connect Remote Desktop',
      description: 'Scan the QR code or manually enter the Connection ID and PIN on the remote app.',
      size: 'sm',
      component: content
    });

    state.onAuthenticated = () => {
      statusToast.classList.remove('hidden');
      qrContainer.classList.add('opacity-20');
    };
    
    // Reuse existing ID/PIN if available, otherwise generate new
    if (!state.lastConnectionId) {
      state.lastConnectionId = Math.random().toString(36).substring(2, 10).toUpperCase();
      state.pin = generatePin();
    }

    const hostPeerId = `codelane-host-${state.lastConnectionId}`;
    
    idText.innerText = state.lastConnectionId;
    pinText.innerText = state.pin;
    
    const peerOptions = { debug: 2 };
    if (settings.signalingServer === 'custom' && settings.peerJsKey) {
      peerOptions.key = settings.peerJsKey;
    }
    
    peer = new window.Peer(hostPeerId, peerOptions);
    
    peer.on('open', (id) => {
      const url = `https://remote.codelane.app/?host=${id}&pin=${state.pin}`;
      // Use free QR Server API
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    });
    
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        state.authenticated = false;
        cleanupListeners();
        
        conn.on('data', (data) => handleRemoteData(data, context, state, conn));
      });
      
      conn.on('close', () => {
        cleanupListeners();
        state.setConnected(false);
        state.activeConnection = null;
        if (statusToast && !statusToast.classList.contains('hidden')) {
          statusToast.classList.add('hidden');
        }
        if (qrContainer) {
          qrContainer.classList.remove('opacity-20');
        }
      });
    });
    
    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      alert(`Connection error: ${err.message}`);
      context.closeDialog();
    });
  };

  const startExtensionLogic = () => {
    context.registerSettings([
      { id: 'signalingServer', type: 'select', title: 'Signaling Server', options: [{label: 'Default Free Tier', value: 'default'}, {label: 'Bring Your Own', value: 'custom'}], defaultValue: 'default' },
      { id: 'peerJsKey', type: 'string', title: 'PeerJS Key', description: 'Used only if "Bring Your Own" is selected' },
    ]);

    context.registerStatusBarItem({
      id: 'connection-status',
      alignment: 'right',
      priority: 100,
      component: () => {
        const el = document.createElement('div');
        el.className = 'flex items-center gap-1.5 cursor-pointer hover:text-zed-text-primary transition-colors px-2 py-0.5 rounded bg-zed-bg-app border border-zed-border-subtle hover:border-zed-border-default text-xs';
        const render = () => {
          const icon = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.828a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>`;
          
          if (state.isConnected) {
            el.innerHTML = `${icon}<span class="font-medium">Remote Desktop</span>`;
            el.className = 'flex items-center gap-1.5 cursor-pointer transition-colors px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 text-xs';
          } else {
            el.innerHTML = `${icon}<span class="opacity-80">Remote Desktop</span>`;
            el.className = 'flex items-center gap-1.5 cursor-pointer hover:text-zed-text-primary transition-colors text-zed-text-tertiary px-2 py-0.5 rounded bg-zed-bg-app border border-zed-border-subtle hover:border-zed-border-default text-xs';
          }
        };
        render();
        state.listeners.push(render);
        el.onclick = () => {
          startHosting();
        };
        return el;
      }
    });
  };

  // Start the loading process
  initializeExtension();
}

// Global registry for extension activation
if (typeof window !== 'undefined') {
  window.CodeLaneExtensions = window.CodeLaneExtensions || {};
  window.CodeLaneExtensions['remote-desktop'] = {
    activate
  };
}
