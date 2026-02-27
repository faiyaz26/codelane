# Codelane Architecture Plan: Extension Ecosystem & Remote Sync

## 1. Vision & Goals
To maintain Codelane's extreme performance and low binary size ("zero bloat"), new features like WebRTC Remote Sync, LSP servers, and custom AI agents will be implemented as **opt-in extensions**. 

This plan outlines a VS Code-style extension architecture utilizing Tauri's capabilities, followed by the specific implementation of the **WebRTC Remote Sync** feature as the flagship extension.

---

## 2. Core Extension Architecture

### 2.1. Extension Anatomy
Extensions will be distributed as compressed archives (e.g., `.zip` or `.clpack`) hosted externally (GitHub Releases, custom registry).
An extracted extension will look like this:

```text
my-extension/
├── manifest.json       # Metadata, permissions, entry points
├── frontend/
│   └── index.js        # Compiled SolidJS/Vanilla UI code (ES Module)
└── backend/
    └── sidecar.js      # (Optional) Node.js script, Go binary, or LSP
```

### 2.2. Installation & Lifecycle (Rust Backend)
1. **Download & Extract:** Rust downloads the extension and extracts it to the OS-specific app data directory (e.g., `~/.config/codelane/extensions/`).
2. **Registration:** Rust parses `manifest.json` and adds it to the active extensions list.
3. **Execution (Backend Sidecars):** For heavy extensions (LSPs, Node scripts), Rust spawns a `std::process::Command` as a child process. Communication happens via **JSON-RPC over standard input/output (stdio)** to prevent crashes from affecting the main Codelane app.
4. **Execution (WASM):** For lightweight, highly secure text processing, the existing `codelane-plugin` `wasmtime` implementation will be used.

### 2.3. Frontend Injection (SolidJS + Tauri)
To load extension UI without recompiling Codelane, we will leverage Tauri's `asset://` protocol.
1. On boot, SolidJS asks Rust for installed extension paths.
2. SolidJS dynamically imports the extension's JS bundle:
   ```javascript
   const ext = await import(`https://asset.localhost/extensions/${id}/frontend/index.js`);
   ext.activate(CodelaneAPI);
   ```
3. **The Codelane API:** The core app will pass a secure API object to the extension, allowing it to:
   - Add sidebar icons and tabs.
   - Read/Write to active terminal PTYs.
   - Listen to Lane events (switch, create, close).

---

## 3. Flagship Extension: Remote Sync (WebRTC)

The Remote Sync feature will be built using this new extension system. It allows users to control agents, view lanes, and preview local dev servers from their mobile devices securely.

### 3.1. Architecture Split
This feature consists of two completely separate codebases:
1. **The Desktop Extension (`codelane-remote-ext`):** A frontend-only plugin dynamically loaded into Codelane. It handles the WebRTC Host logic.
2. **The Mobile Client (`codelane-remote-pwa`):** A standalone SolidJS Progressive Web App hosted on Vercel/Netlify. It acts as the WebRTC Client.

### 3.2. Connection Flow (PeerJS + WebRTC)
1. User clicks the "Remote Sync" icon (injected by the extension) in Codelane Desktop.
2. The extension generates a random PeerJS ID and an **Ephemeral Security PIN**.
3. Codelane displays a QR code containing the connection URL: `https://remote.codelane.app/?id=<PEER_ID>`
4. The user scans the QR code with their phone.
5. The Mobile PWA connects to the Desktop Extension via WebRTC Data Channels.
6. The Mobile PWA prompts for the Security PIN to authenticate the session.

### 3.3. Security Posture (Critical)
To avoid the pitfalls of previous local AI tools (auth bypass, over-privileged agents):
- **No Open Ports:** The Rust backend will NOT spin up local HTTP/WebSocket servers. All traffic is P2P WebRTC handled by the frontend.
- **Strict Authentication:** The WebRTC channel drops any messages unless the session has been authenticated with the Ephemeral PIN.
- **Visual Audit Trail:** All remote commands (e.g., typing a prompt to Aider) are immediately visible in the Codelane Desktop UI.
- **Environment Sanitization:** When a remote agent is triggered, the Codelane API will strip sensitive environment variables (like `~/.aws/credentials`) from the PTY, passing only what is explicitly required.

### 3.4. Localhost Port Proxying (The "Ngrok" Alternative)
To view local dev servers (like Next.js on port 3000) on the mobile device:
1. The Mobile PWA registers a **Service Worker**.
2. When the user navigates to `<iframe src="/proxy/3000">`, the Service Worker intercepts the request.
3. The Service Worker forwards the HTTP request details over the WebRTC Data Channel.
4. The Desktop Extension receives the request, uses Tauri's `fetch` API to hit `http://localhost:3000`, and sends the HTML/CSS/JS back over WebRTC.
5. The Service Worker reconstructs the response, rendering the site on the phone without the data ever leaving the P2P connection.

---

## 4. Implementation Phases

### Phase 1: Extension Infrastructure
- [ ] Add extension directory resolution to `src-tauri/src/fs.rs`.
- [ ] Implement `.zip` download and extraction in Rust.
- [ ] Enable `assetProtocol` in `tauri.conf.json` for the extensions directory.
- [ ] Define the `CodelaneAPI` interface in the SolidJS frontend.
- [ ] Build the dynamic `import()` loader for extension frontends.

### Phase 2: Remote Sync Extension (Host)
- [ ] Create a new repo/folder for the `codelane-webrtc-ext`.
- [ ] Implement `peerjs` in the extension frontend.
- [ ] Build the UI component to display the QR Code and PIN.
- [ ] Map WebRTC incoming messages to `CodelaneAPI` commands (e.g., `api.lanes.getActive()`, `api.terminal.write()`).

### Phase 3: Mobile PWA Client
- [ ] Create a new SolidJS project for the PWA.
- [ ] Add `vite-plugin-pwa` for mobile installation support.
- [ ] Implement the UI: Lane switcher, Terminal viewer (xterm.js), and Agent chat input.
- [ ] Implement the Service Worker interception logic for localhost port proxying.
