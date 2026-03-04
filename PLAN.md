# CodeLane Architecture Plan: Remote Desktop Extension

## 1. Vision & Goals
Introduce a new `remote-desktop` extension to enable WebRTC-based P2P broadcasting from the CodeLane desktop app to a mobile or web app. This feature will securely stream agent terminal output, lane information, files, and code reviews, effectively allowing remote access to the local development environment.

We aim for extreme robustness, resilience, modularity, and comprehensive testing, while ensuring the implementation adheres to CodeLane's zero-bloat philosophy.

## 2. Core Architecture

### 2.1 Extension Ecosystem Upgrades
To support complex extensions like `remote-desktop`, the existing extension system will be enhanced with new APIs:
- **Settings API (Declarative JSON Schema):** Extensions will define their configurable options using a declarative JSON schema. The main CodeLane settings modal will safely and dynamically render these settings (e.g., an "Extensions" tab).
- **Event Broadcasting API:** Extensions will hook into core application state (lanes, terminal outputs, file tree changes, AI reviews) to listen to and broadcast updates securely.

### 2.2 WebRTC P2P Broadcast
The `remote-desktop` extension will act as the WebRTC Host.
- **Signaling Provider:** We will provide a Default Free Tier provider (e.g., pre-configured OpenRelay or PeerJS) out of the box so the extension works immediately, while allowing users to override these settings via the new Extension Settings API.
- **Connection Flow (QR Code & PIN):**
  1. In the bottom-right status bar (next to resource usage), the app displays a "Connect Remote" (or similar) button when disconnected. Clicking this opens the connection modal.
  2. The Desktop app generates a unique Peer ID and a secure, ephemeral Session PIN.
  3. The Desktop UI modal displays a scannable QR Code containing the auth token, along with the fallback short PIN.
  4. The mobile/web app acts as the WebRTC Client. Scanning the QR code handles connection instantly; otherwise, the user manually inputs the fallback PIN.
  5. Once authenticated, a secure Data Channel is established, and the status bar updates to show the connected client's status (e.g., "Connected to Client").

## 3. Data Streaming & Features
Post-handshake, the extension streams the following over the WebRTC Data Channel in a **Bi-directional (Interactive)** manner:
- **Terminal Control:** Live streaming of agent commands and stdout/stderr. The remote client will be able to type into the terminal and trigger actions directly from the mobile app.
- **Lane Information:** Active lane context, task statuses, and real-time updates.
- **File Access:** Secure streaming of the file tree and file diffs.
- **Code Review:** Broadcasting AI-generated code reviews, allowing remote users to approve or modify them.

## 4. Security Posture (Critical & Hardened)
Security is paramount since we are exposing the local development environment and allowing interactive control. We will employ a defense-in-depth strategy:

- **Strict P2P Only (No Open Ports):** No local HTTP, TCP, or WebSocket servers will be opened by the Rust backend or frontend. All communication strictly flows through WebRTC Data Channels managed by the frontend extension. No firewall exceptions are needed.
- **End-to-End Encryption & Authentication:** WebRTC natively provides DTLS/SRTP encryption. Additionally, the ephemeral Session PIN (and QR token) acts as a cryptographic shared secret. All incoming WebRTC messages must be accompanied by an HMAC/auth-token derived from the PIN; unauthenticated or malformed packets are dropped instantly at the ingress layer.
- **Strict Payload Validation (Zero Trust):** We will implement a Zero Trust model for all incoming WebRTC data. Every message will be rigorously validated against strict JSON schemas (using a library like Zod or Arktype). Unexpected fields, overly large payloads, or malformed commands will result in the immediate termination of the WebRTC connection.
- **No Arbitrary Code Execution (No Eval):** The extension will *never* use `eval()` or dynamically execute incoming code. All remote commands are mapped to strictly predefined `CodelaneAPI` methods (e.g., `api.terminal.write(data)`).
- **Explicit User Confirmation (Destructive Actions):** High-risk actions triggered remotely (e.g., executing a command outside the allowed terminal scope, deleting files, or approving a PR) will trigger a visual prompt in the Desktop App requiring physical user confirmation before proceeding.
- **Granular Permissions & Sandboxing:** The extension manifest will explicitly declare its needed permissions (`terminal:read`, `terminal:write`, `fs:read`). The Codelane backend will enforce these boundaries, ensuring the extension (and by extension, the remote user) cannot access files outside the active workspace.
- **Audit Logging & Visual Trails:** The Desktop UI will display a persistent "Connected to Client" indicator in the bottom-right status bar (alongside resource usage). All remote connections, disconnected events, and significant interactions (e.g., remote terminal keystrokes, file reads) will be visibly logged in a dedicated "Remote Audit" lane.
- **Environment Sanitization:** When a remote agent is triggered, sensitive environment variables (like `AWS_ACCESS_KEY_ID`, `OPENAI_API_KEY`) will be aggressively stripped or masked from the PTY output before transmission over WebRTC.

## 5. Implementation Phases

### Phase 1: Core API & Extension Settings
- Expand `CodelaneAPI` to support Settings Registration using a declarative JSON schema approach.
- Update the desktop UI to safely dynamically render extension settings in the global settings modal.
- Create unit tests for the updated extension registration and lifecycle flow.

### Phase 2: WebRTC Integration & Host Extension
- Initialize the `remote-desktop` extension bundle.
- Integrate the Default Free Tier signaling server.
- Implement UI components for QR Code / Session PIN generation.
- Establish robust error handling and reconnection logic for the P2P connection.

### Phase 3: Bi-directional Data Hooks
- Hook into terminal, lane, and file system states for reading and writing.
- Serialize state changes efficiently and broadcast over the established WebRTC data channel.
- Implement rate-limiting and chunking for large data transfers (e.g., file contents).

### Phase 4: Remote Client (Web/Mobile)
- Build a lightweight web client (or PWA) to act as the WebRTC receiver and sender.
- Implement rendering for remote interactive terminals, lane views, and file diffs.
- Ensure end-to-end integration tests validate the security, input validation, and stability of the bidirectional broadcast.
