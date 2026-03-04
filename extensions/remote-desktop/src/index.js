// Logic for testability
const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();
const generatePeerId = () => `codelane-host-${Math.random().toString(36).substring(2, 10)}`;

async function handleRemoteData(data, context, state, conn) {
  if (!state.authenticated) {
    if (data.type === 'auth' && data.pin === state.pin) {
      state.authenticated = true;
      state.activeConnection = conn;
      state.setConnected(true);
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
        conn.send({ 
          type: 'terminal:data', 
          terminalId: data.terminalId, 
          data: Array.from(chunk) 
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
    activeConnection: null,
    activeTerminalListeners: {},
    listeners: [],
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
    qrContainer.className = 'bg-white p-3 rounded-xl shadow-inner mb-6 flex items-center justify-center';
    
    const qrImage = document.createElement('img');
    qrImage.className = 'w-[180px] h-[180px]';
    qrImage.alt = 'Connecting QR Code';
    qrContainer.appendChild(qrImage);
    
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
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'w-full h-10 inline-flex items-center justify-center rounded-md font-medium transition-colors bg-zed-bg-surface hover:bg-zed-bg-hover border border-zed-border-default text-zed-text-primary text-sm';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = () => {
      context.closeDialog();
      if (peer) { peer.destroy(); peer = null; }
    };
    
    content.appendChild(qrContainer);
    content.appendChild(infoGrid);
    content.appendChild(cancelBtn);
    
    return { content, qrImage, idText, pinText };
  };

  let peer = null;

  const startHosting = async () => {
    const settings = await context.getSettings();
    const { content, qrImage, idText, pinText } = createModalContent();
    
    context.openDialog({
      title: 'Connect Remote Client',
      description: 'Scan the QR code or manually enter the Connection ID and PIN on the remote app.',
      size: 'sm',
      component: content
    });
    
    const connectionId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const hostPeerId = `codelane-host-${connectionId}`;
    state.pin = generatePin();
    
    idText.innerText = connectionId;
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
        el.className = 'flex items-center gap-1 cursor-pointer hover:text-zed-text-primary transition-colors text-zed-text-tertiary px-2 py-0.5 rounded bg-zed-bg-app border border-zed-border-subtle hover:border-zed-border-default text-xs';
        const render = () => {
          el.innerHTML = state.isConnected 
            ? `<div class="w-2 h-2 rounded-full bg-green-500 mr-1"></div><span class="font-medium text-green-400">Connected to Client</span>`
            : `<div class="w-2 h-2 rounded-full bg-zed-text-disabled mr-1"></div><span>Connect Remote</span>`;
        };
        render();
        state.listeners.push(render);
        el.onclick = () => {
          if (!state.isConnected) startHosting();
          else if (confirm('Disconnect remote client?')) {
            if (state.activeConnection) state.activeConnection.close();
            state.setConnected(false);
          }
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
