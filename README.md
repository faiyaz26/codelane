# Codelane

An AI orchestrator for local development. Manage multiple projects ("lanes") with integrated terminals, code editor, and git interface.

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite
- **Backend**: Rust + Tauri 2.x
- **Styling**: Tailwind CSS
- **Terminal**: portable-pty + xterm.js
- **Editor**: Monaco Editor (VS Code's editor)
- **Git**: gitoxide (pure Rust git)

## Quick Start

### Prerequisites

**Required:**
- Rust 1.75+ (`rustup update stable`)
- Node.js 22+ (use `.nvmrc` with `nvm use`)
- pnpm 9+ (`npm install -g pnpm`)

**Platform-specific:**

<details>
<summary><b>macOS</b></summary>

```bash
xcode-select --install
```
</details>

<details>
<summary><b>Linux (Ubuntu/Debian)</b></summary>

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```
</details>

<details>
<summary><b>Windows</b></summary>

- Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
</details>

### Development

```bash
# Install dependencies (pnpm workspaces handles frontend automatically)
pnpm install

# Run in development mode
make dev
# or
pnpm dev
```

### Production Build

```bash
# Build for current platform
make build

# Output in src-tauri/target/release/bundle/
```

## Project Structure

```
codelane/
├── frontend/               # SolidJS frontend
│   ├── src/
│   │   ├── App.tsx         # Main app component
│   │   └── index.css       # Tailwind styles
│   ├── package.json
│   └── vite.config.ts      # Vite + Tauri configuration
│
├── src-tauri/              # Tauri backend (native shell)
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── terminal.rs     # PTY commands
│   │   ├── git.rs          # Git commands
│   │   └── fs.rs           # Filesystem commands
│   └── tauri.conf.json     # Tauri configuration
│
├── crates/                 # Rust backend crates
│   ├── codelane-core/      # Core types (Lane, Config)
│   ├── codelane-terminal/  # Terminal emulation
│   ├── codelane-editor/    # Monaco editor integration
│   ├── codelane-git/       # Git operations
│   ├── codelane-lsp/       # LSP client
│   ├── codelane-review/    # Code review
│   ├── codelane-plugin/    # WASM plugins
│   └── codelane-ui/        # Shared UI components
│
└── Makefile                # Build commands
```

## Crate Overview

| Crate | Purpose |
|-------|---------|
| `codelane-core` | Core types: `Lane`, `LaneManager`, `AppConfig`, ID types |
| `codelane-terminal` | PTY spawning, ANSI parsing, 256-color support |
| `codelane-editor` | Monaco Editor types, JS bridge for WebView interop |
| `codelane-git` | Git operations using CLI commands |
| `codelane-lsp` | Language Server Protocol client (tower-lsp) |
| `codelane-review` | Code review types: comments, checklists, suggestions |
| `codelane-plugin` | WASM plugin system with wasmtime |
| `codelane-ui` | Shared UI components and hooks |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Tauri Shell                      │
│  • Window management, permissions, updates      │
├─────────────────────────────────────────────────┤
│                  WebView                         │
│  ┌───────────────────────────────────────────┐  │
│  │    SolidJS Frontend (TypeScript + Vite)   │  │
│  │  • Lane management UI                     │  │
│  │  • Terminal views (xterm.js)              │  │
│  │  • Monaco editor                          │  │
│  │  • Git interface                          │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│              Tauri Commands (Rust)               │
│  • Terminal/PTY operations                       │
│  • Git operations                                │
│  • File system access                            │
└─────────────────────────────────────────────────┘
```

## Development Commands

```bash
# Development
make dev          # Start Tauri + SolidJS dev server
make frontend     # Run frontend only (Vite)

# Building
make build        # Build release binary
make release      # Build optimized release

# Code Quality
make check        # Run cargo check
make test         # Run all tests
make fmt          # Format code
make lint         # Run clippy

# Maintenance
make clean        # Clean build artifacts
make install      # Install required tools
```

## Key Features

- **Lanes**: Isolated workspaces per project with their own terminals and state
- **Terminal**: Full ANSI support (256 colors, cursor control, scroll regions) via xterm.js
- **Editor**: Monaco Editor with syntax highlighting for 50+ languages
- **Git**: Visual git interface with staging, commits, diffs
- **Cross-platform**: macOS, Windows, Linux via Tauri

## Troubleshooting

### Build fails with missing dependencies
```bash
pnpm install
```

### Hot reload not working
- Check that port 1420 is not in use
- Restart the dev server: `make dev`

### Clean build from scratch
```bash
make clean
pnpm install
make build
```

## License

MIT
