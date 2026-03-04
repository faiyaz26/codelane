import { Peer } from 'peerjs';
import QRCode from 'qrcode';

// Extract logic for testability
export const generatePin = () => Math.floor(100000 + Math.random() * 900000).toString();
export const generatePeerId = () => `codelane-host-${Math.random().toString(36).substring(2, 10)}`;

export async function handleRemoteData(data, context, state, conn) {
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

export function activate(context) {
  context.registerSettings([
    { id: 'signalingServer', type: 'select', title: 'Signaling Server', options: [{label: 'Default Free Tier', value: 'default'}, {label: 'Bring Your Own', value: 'custom'}], defaultValue: 'default' },
    { id: 'peerJsKey', type: 'string', title: 'PeerJS Key', description: 'Used only if "Bring Your Own" is selected' },
  ]);

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

  const createModal = () => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm';
    const content = document.createElement('div');
    content.className = 'bg-zed-bg-overlay border border-zed-border-default rounded-lg shadow-2xl p-6 max-w-sm w-full flex flex-col items-center';
    const title = document.createElement('h2');
    title.className = 'text-lg font-semibold text-zed-text-primary mb-2';
    title.innerText = 'Connect Remote Client';
    const desc = document.createElement('p');
    desc.className = 'text-sm text-zed-text-secondary text-center mb-6';
    desc.innerText = 'Scan this QR code with your mobile device, or enter the PIN manually on the remote app.';
    const qrContainer = document.createElement('div');
    qrContainer.className = 'bg-white p-2 rounded-lg mb-4';
    const canvas = document.createElement('canvas');
    qrContainer.appendChild(canvas);
    const pinContainer = document.createElement('div');
    pinContainer.className = 'bg-zed-bg-panel border border-zed-border-subtle rounded-md px-4 py-2 flex items-center justify-center gap-2 w-full mb-6';
    const pinText = document.createElement('span');
    pinText.className = 'text-2xl font-mono tracking-[0.2em] font-bold text-zed-accent-blue';
    pinContainer.appendChild(pinText);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-2 bg-zed-bg-panel border border-zed-border-default rounded-md text-zed-text-primary hover:bg-zed-bg-hover transition-colors w-full';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = () => {
      document.body.removeChild(modal);
      if (peer) {
        peer.destroy();
        peer = null;
      }
    };
    content.appendChild(title);
    content.appendChild(desc);
    content.appendChild(qrContainer);
    content.appendChild(pinContainer);
    content.appendChild(cancelBtn);
    modal.appendChild(content);
    return { modal, canvas, pinText, cancelBtn };
  };

  let peer = null;

  const startHosting = async () => {
    const settings = await context.getSettings();
    const { modal, canvas, pinText } = createModal();
    document.body.appendChild(modal);
    
    state.pin = generatePin();
    pinText.innerText = state.pin;
    
    const peerOptions = { debug: 2 };
    if (settings.signalingServer === 'custom' && settings.peerJsKey) {
      peerOptions.key = settings.peerJsKey;
    }
    
    peer = new Peer(generatePeerId(), peerOptions);
    
    peer.on('open', (id) => {
      const url = `https://remote.codelane.app/?host=${id}&pin=${state.pin}`;
      QRCode.toCanvas(canvas, url, { width: 200, margin: 1 });
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
      document.body.removeChild(modal);
    });
  };

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
}
