# CodeLane Extension System Architecture Plan

## 1. Overview
The goal of the CodeLane extension system is to provide a highly capable, secure, and flexible environment for extending the core functionality of the application. Extensions must be powerful enough to support features like Language Server Protocol (LSP) integrations, Model Context Protocol (MCP) clients, and complex features like WebRTC-based remote desktop access for mobile/web devices.

**Key Requirements:**
- **Decoupled:** Extensions are not bundled with the main application.
- **On-Demand:** Users manually install/enable extensions post-app installation.
- **Sourced via GitHub:** Extension metadata and assets are fetched from GitHub repositories (initially from this repo, later from 3rd parties).
- **High Capability:** Must support background processing, complex networking (WebRTC), and UI injection.

---

## 2. Architectural Approaches

Given CodeLane's stack (Rust/Tauri Backend + SolidJS Frontend), extending the app requires careful consideration of where the extension code runs and how it interacts with the system.

### Approach A: Multi-Process Architecture (IPC / RPC)
Extensions are standalone binaries or scripts (e.g., Node.js, Deno, Python, or Rust binaries) that are spawned by the main Rust backend and communicate via IPC (Standard I/O, local WebSockets, or gRPC).

* **Pros:**
  * **Language Agnostic:** Extension authors can use any language.
  * **Fault Isolation:** An extension crash will not take down the main Tauri app.
  * **Natural fit for LSP/MCP:** Both protocols already operate over stdio/RPC, making this a native fit.
  * **Full System Capabilities:** Easy to run heavy native processes (like WebRTC implementations).
* **Cons:**
  * **Overhead:** Serialization/deserialization over IPC.
  * **Lifecycle Management:** The main app must manage child process lifecycles (zombie processes).
  * **Distribution:** Requires platform-specific binaries or bundling a runtime (like Node/Deno).

### Approach B: WebAssembly (WASM / WASI)
Extensions are compiled to WebAssembly and executed inside a WASM runtime (like Wasmtime or Wasmer) embedded in the Rust backend.

* **Pros:**
  * **Security:** Extremely secure, strictly sandboxed execution.
  * **Portability:** Write once, run anywhere (no platform-specific binaries).
  * **Performance:** Near-native speed, low startup time.
* **Cons:**
  * **Limited Capabilities:** Heavy networking (like WebRTC) or spawning system processes (LSP servers) is very difficult or impossible without complex WASI extensions.
  * **Developer Friction:** Not all languages compile easily to WASI with full standard library support.

### Approach C: Dynamic Libraries (.so / .dll / .dylib)
Extensions are compiled as native dynamic libraries and loaded via FFI by the Rust backend.

* **Pros:**
  * **Maximum Performance:** Direct memory access, zero serialization overhead.
* **Cons:**
  * **Security Risk:** A bug in a plugin can cause a segmentation fault in the entire main application.
  * **Distribution Nightmare:** Requires exact ABI compatibility and platform-specific compilation.

### Approach D: Frontend-Only JS/TS Plugins
Extensions are purely JavaScript bundles loaded at runtime into the SolidJS frontend.

* **Pros:**
  * **Easy UI Integration:** Simple to inject components or themes.
  * **Simple Distribution:** Just ship JS files.
* **Cons:**
  * **Restricted Backend Access:** Relies entirely on the Tauri commands exposed by the main app.
  * **Performance:** Running heavy tasks in the frontend blocks the UI thread. Cannot run if the frontend is closed/backgrounded.

---

## 3. Recommended Architecture: Hybrid RPC + Sandboxed UI

To support the requested powerful features (WebRTC, LSP, MCP) while maintaining security and stability, CodeLane should adopt a **Hybrid Architecture**:

1. **Backend Extension Host (Sidecars/RPC):** 
   Heavy extensions run as separate processes communicating with the Rust backend via JSON-RPC over `stdio` or a local WebSocket. This handles LSP, MCP, and WebRTC signaling.
2. **Frontend Extension Host (UI Injections):** 
   Extensions that need UI representation provide JavaScript bundles. These run inside sandboxed environments (e.g., Web Workers or secure Iframes) or are dynamically loaded into the SolidJS app with access to a scoped CodeLane API object.

### The Main App as a Router
CodeLane will act as a message router. An extension can send a message to the Rust backend requesting data (e.g., `get_terminal_buffer`), and the backend responds. The backend can also emit events to extensions (e.g., `on_file_changed`).

---

## 4. Extension Distribution & Lifecycle

### Registry and Metadata
All metadata will live in this repository initially. We will maintain an `extensions.json` (or a dedicated folder `extensions/`) containing references to available extensions.

```json
{
  "remote-desktop": {
    "version": "1.0.0",
    "description": "Access CodeLane remotely via WebRTC",
    "repository": "https://github.com/codelane/codelane-remote",
    "releases_url": "https://api.github.com/repos/codelane/codelane-remote/releases/latest"
  }
}
```

### Installation Flow
1. **Discover:** UI fetches the registry and displays available extensions.
2. **Download:** User clicks "Install". App downloads the release assets (platform-specific binaries and JS UI bundles) from GitHub.
3. **Verify:** App verifies checksums/signatures.
4. **Extract & Register:** Files are placed in `~/.codelane/extensions/<ext-id>/`. The extension's `manifest.json` is registered in the database.

### `manifest.json` Structure
```json
{
  "id": "com.codelane.remote-desktop",
  "name": "Remote Desktop",
  "main_backend": "./bin/remote-desktop-mac-arm64",
  "main_frontend": "./ui/dist/bundle.js",
  "permissions": [
    "terminal:read",
    "terminal:write",
    "lanes:read",
    "ui:register_panel"
  ]
}
```

---

## 5. Proposed Extension API

Extensions interact with CodeLane via a well-defined API. For backend RPC processes, this is done via JSON-RPC. For frontend JS, via a `window.codelane` object.

### Core Capability Domains
* `codelane.workspace`: File reads/writes, file tree structure, search.
* `codelane.terminal`: Spawn PTYs, write to stdin, read stdout streams.
* `codelane.lanes`: Inspect running tasks, start/stop lanes.
* `codelane.ui`: Register sidebar panels, context menu items, command palette actions, show notifications.
* `codelane.lsp` / `codelane.mcp`: Register as a provider for language features or LLM context.

### Case Study: WebRTC Remote Desktop Extension
1. **Startup:** CodeLane spawns the extension binary.
2. **Connection:** Extension connects back to CodeLane's internal RPC server.
3. **Initialization:** Extension reads `codelane.workspace.getInfo()` and subscribes to `codelane.events.terminal.onData`.
4. **WebRTC Setup:** Extension establishes a WebRTC PeerConnection with a remote client (handling its own signaling via an external server).
5. **Streaming:** When terminal data comes in via the CodeLane RPC, the extension pipes it over WebRTC DataChannels.
6. **Commands:** When the remote user types, the extension receives via WebRTC and calls `codelane.terminal.write(id, data)` over RPC.

---

---

## 6. Local Extension Development (Developer Mode)

To ensure a smooth developer experience (DX), CodeLane will include a **Developer Mode** for creating and testing extensions locally without needing to publish them to GitHub.

### Workflow
1. **Scaffolding:** Developers can use a CLI command (e.g., `codelane create-extension my-ext`) to generate a boilerplate extension with a `manifest.json`, a basic Rust/Node backend, and a SolidJS/Vanilla UI frontend.
2. **Local Registration:** Instead of downloading from GitHub, developers can link a local directory using `codelane extension link ./my-ext`. This will create a symlink in `~/.codelane/extensions/` or register the absolute path in the local database.
3. **Hot Reloading:** 
   - **Frontend UI:** Changes to the extension's JS/CSS will be dynamically reloaded in the CodeLane UI (potentially via Vite's HMR or by watching the `dist` folder and re-injecting).
   - **Backend RPC:** If the extension's backend binary/script changes, CodeLane will detect the file change, gracefully terminate the existing child process, and restart it automatically.
4. **Debugging:** 
   - **UI:** Extension developers can use the standard browser DevTools (available in Tauri debug builds) to inspect their injected UI components.
   - **Backend:** CodeLane will stream the `stdout`/`stderr` of the extension's sidecar process to a dedicated "Extension Developer Console" panel within the app, allowing developers to see logs and errors in real-time. Developers can also attach their own debuggers (like `lldb` or Node inspector) to the sidecar process by specifying debug flags in `manifest.json`.

---

## 7. Implementation Roadmap

### Phase 1: Foundation (In-Repo)
* Define the JSON-RPC protocol schema.
* Implement the Extension Manager in Rust (discovering, spawning, and monitoring child processes).
* Build a simple proof-of-concept extension (e.g., a "Clock" or "System Monitor" that logs to a CodeLane output panel).

### Phase 2: Distribution & Security
* Implement the UI for the Extension Marketplace (fetching from `extensions.json`).
* Implement downloading from GitHub Releases and unpacking into `~/.codelane/extensions/`.
* Implement a basic Permissions model (warning users if an extension requests `workspace:write`).

### Phase 3: Advanced APIs & WebRTC
* Expose Terminal, Lanes, and Workspace APIs over RPC.
* Build the WebRTC Remote Desktop extension to validate the API's capability to handle streaming data.

### Phase 4: Frontend UI Injection
* Implement a secure mechanism to load extension UI code into SolidJS (e.g., dynamic imports with scoped contexts, or iframes for full isolation).
* Allow extensions to register custom tabs or sidebar panels.
