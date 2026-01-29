# Tauri Best Practices - Codelane

This document outlines the Tauri best practices implemented in this project.

## ✅ Security

### Content Security Policy (CSP)
- **Removed** `unsafe-eval` - prevents arbitrary code execution
- **Removed** external CDNs - all assets served locally
- **Added** `wasm-unsafe-eval` - required for WASM (SolidJS)
- **Restricted** `script-src` to `'self'` only
- **Enabled** `freezePrototype` - prevents prototype pollution

### Asset Protocol
- Enabled secure asset loading via `asset://` protocol
- Scoped to `$APPDATA` and `$RESOURCE` directories only

### Permissions (Principle of Least Privilege)
- Capabilities defined in `src-tauri/capabilities/default.json`
- Only granted permissions needed for dev tool functionality:
  - ✅ File system (needed for code editing)
  - ✅ Shell execution (needed for terminals)
  - ✅ Dialog (needed for file pickers)
  - ✅ Clipboard (needed for copy/paste)

## ✅ Performance

### Build Optimizations
- Target modern browsers: ES2021, Chrome 100+, Safari 13+
- Minification enabled for production builds
- Source maps only in debug mode
- Manual chunk splitting disabled (better for desktop apps)

### Development
- Strict port enforcement (1420)
- File watching excludes `src-tauri/` directory
- Clear screen disabled (better error visibility)

## ✅ Architecture

### Project Structure
```
codelane/
├── frontend/              # SolidJS + Vite (frontend only)
├── src-tauri/            # Tauri backend (Rust)
│   ├── capabilities/     # Permission definitions
│   └── icons/           # App icons
└── crates/              # Shared Rust libraries
```

### Separation of Concerns
- Frontend: UI logic, state management, user interactions
- Backend: System access, file I/O, shell commands, git operations
- Communication: Via Tauri IPC (commands + events)

## ✅ Configuration

### Window Settings
- `hiddenTitle: true` - Modern macOS integration
- `titleBarStyle: "Overlay"` - Native titlebar
- `withGlobalTauri: false` - Use secure Tauri import instead

### Development
- Frontend runs on `localhost:1420` (fixed port)
- Tauri dev watches for changes
- Hot module replacement (HMR) via Vite

## 📦 Dependencies

### Frontend (@tauri-apps packages)
- `@tauri-apps/api` - Core Tauri API
- `@tauri-apps/plugin-*` - Plugin APIs (shell, fs, dialog)

### Backend (Cargo)
- Tauri 2.x with required features:
  - `protocol-asset` - Asset protocol support
  - `devtools` - DevTools in development

## 🔒 Security Checklist

- [x] CSP configured restrictively
- [x] No `unsafe-eval` in production
- [x] External resources blocked
- [x] Asset protocol enabled with scope
- [x] Prototype freezing enabled
- [x] Permissions follow least privilege
- [x] Updater disabled (manual updates only)

## 🚀 Performance Checklist

- [x] Build target optimized for desktop
- [x] Minification enabled
- [x] Source maps only in debug
- [x] HMR configured correctly
- [x] File watching optimized

## 📚 Resources

- [Tauri Security Best Practices](https://tauri.app/v2/security/)
- [Tauri Configuration](https://tauri.app/v2/reference/config/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
