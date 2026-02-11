# Codelane

**Professional Development Environment** - A powerful desktop application designed for managing multiple project workspaces with integrated AI capabilities, terminal access, git workflows, and intelligent code navigation.

Built on Tauri and SolidJS for native performance, Codelane streamlines your development workflow with isolated project lanes, AI-powered code review, dependency-aware file sorting, and comprehensive git management.

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

## Testing

The backend has comprehensive test coverage for core modules.

### Running Tests

```bash
# Run all backend tests
cargo test --lib

# Run tests for a specific module
cargo test --lib git::tests
cargo test --lib terminal::tests
cargo test --lib search::tests
cargo test --lib process::tests
cargo test --lib lane::tests
cargo test --lib fs::tests
cargo test --lib settings::tests
cargo test --lib db::tests

# Run with output
cargo test --lib -- --nocapture
```

### Test Coverage

| Module | Tests | Line Coverage |
|--------|-------|---------------|
| `search.rs` | 55 | 77.6% |
| `lane.rs` | 45 | 86.3% |
| `terminal.rs` | 37 | 81.2% |
| `git.rs` | 33 | 94.2% |
| `fs.rs` | 28 | 91.1% |
| `settings.rs` | 22 | 78.8% |
| `process.rs` | 12 | 87.1% |
| `db.rs` | 8 | 100% |
| **Total** | **230** | **84.9%** |

Tests use `tempfile` for isolated filesystem tests and cover:
- Serialization/deserialization of all data types
- Git operations with temporary repositories
- Pattern matching and regex escaping
- Thread safety for shared state
- File system operations (read, write, list, watch)
- Lane and settings management
- Terminal payloads and validation
- Error handling and edge cases

## Key Features

### 🚀 Multi-Lane Project Management
- **Isolated Workspaces**: Each lane maintains its own terminal, state, and configuration
- **Branch & Worktree Support**: Work on multiple branches simultaneously
- **Quick Switching**: Seamlessly switch between projects without losing context

### 🤖 AI-Powered Development
- **Code Review Automation**: Integrated with Claude Code, Aider, OpenCode, and Gemini CLI
- **Smart File Sorting**: AI-driven file organization with dependency analysis
- **Intelligent Navigation**: Tree-sitter powered code structure understanding

### 📟 Integrated Terminal
- **Full ANSI Support**: 256 colors, cursor control, scroll regions via xterm.js
- **Agent Integration**: Run AI coding assistants directly in your terminal
- **Process Monitoring**: Track resource usage and terminal processes

### 🎨 Git & Code Review
- **Visual Diff Viewer**: Side-by-side and unified diff modes with syntax highlighting
- **Commit History**: Browse commits with file-level diffs
- **Smart File Sorting**: Review files by category, dependency order, or change size
- **Git Manager**: Stage, commit, and manage changes with a visual interface

### 🎨 Beautiful Themes
- **Codelane Dark**: Custom theme with deep grays (default)
- **Dark & Light**: Alternative themes for different preferences
- **Syntax Highlighting**: 50+ languages supported via Shiki

### ⚡ Native Performance
- **Rust Backend**: Fast, memory-safe operations via Tauri
- **SolidJS Frontend**: Fine-grained reactivity for instant UI updates
- **Cross-platform**: macOS, Windows, Linux with native feel

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
