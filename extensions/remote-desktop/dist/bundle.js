export function activate(context) {
  // Register declarative settings
  context.registerSettings([
    { id: 'signalingServer', type: 'select', title: 'Signaling Server', options: [{label: 'Default Free Tier', value: 'default'}, {label: 'Bring Your Own', value: 'custom'}], defaultValue: 'default' },
    { id: 'peerJsKey', type: 'string', title: 'PeerJS Key', description: 'Used only if "Bring Your Own" is selected' },
  ]);

  let isConnected = false;
  let listeners = [];
  const setConnected = (val) => {
    isConnected = val;
    listeners.forEach(l => l());
  };

  // Register the bottom right status bar item
  context.registerStatusBarItem({
    id: 'connection-status',
    alignment: 'right',
    priority: 100, // Show it closest to the edge
    component: () => {
      const el = document.createElement('div');
      el.className = 'flex items-center gap-1 cursor-pointer hover:text-zed-text-primary transition-colors text-zed-text-tertiary px-2 py-0.5 rounded bg-zed-bg-app border border-zed-border-subtle hover:border-zed-border-default text-xs';
      
      const render = () => {
        el.innerHTML = isConnected 
          ? `<div class="w-2 h-2 rounded-full bg-green-500 mr-1"></div><span class="font-medium text-green-400">Connected to Client</span>`
          : `<div class="w-2 h-2 rounded-full bg-zed-text-disabled mr-1"></div><span>Connect Remote</span>`;
      };
      
      render();
      listeners.push(render);

      el.onclick = () => {
        if (!isConnected) {
          // Placeholder for the QR code modal handshake
          alert('Generating WebRTC QR Code for Handshake...');
          setTimeout(() => setConnected(true), 1500); // Simulate connection
        } else {
          if (confirm('Disconnect remote client?')) {
            setConnected(false);
          }
        }
      };

      return el;
    }
  });

  console.info("Remote Desktop Mock Extension Activated!");
}
