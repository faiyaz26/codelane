# CodeLane Extension System - Phase 1 Implementation

## Completed Tasks
- [x] Defined `ExtensionManifest` and `Extension` structures in Rust.
- [x] Implemented `ExtensionState` as a Tauri managed state.
- [x] Added `extensions_dir` to `paths.rs` (~/.codelane/dev/extensions).
- [x] Implemented discovery and lifecycle management (start/stop) for backend sidecar extensions.
- [x] Implemented JSON-RPC communication over `stdio` for sidecar extensions.
- [x] Exposed core APIs to extensions via JSON-RPC:
    - `codelane.ping`
    - `codelane.terminal.list`
    - `codelane.terminal.create`
    - `codelane.terminal.write`
    - `codelane.lane.list`
- [x] Created a frontend API wrapper (`extension-api.ts`).
- [x] Integrated `ExtensionManager` UI into the sidebar's activity bar.
- [x] Created a test extension for verification.

## Next Steps
- [ ] Implement extension-to-frontend UI injection (Phase 4).
- [ ] Add event subscription (e.g., `codelane.terminal.onOutput`) to support streaming data (needed for Remote Desktop).
- [ ] Implement WebRTC signaling in a dedicated "Remote Desktop" extension.
- [ ] Add permission checking before starting extensions.
