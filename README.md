<div align="center">
  <img src="assets/icons/codelane_logo.png" alt="Codelane Logo" width="120" height="120">
  <h1>Codelane</h1>
  <p><strong>Agentic Development Environment</strong> - A modern desktop application that enables parallel feature development across multiple project lanes with AI agents and human-in-the-loop code review.</p>
</div>

Built on Tauri and SolidJS for exceptional performance, Codelane empowers developers to work on multiple tasks simultaneously while maintaining control through intelligent code review, dependency-aware navigation, and comprehensive git management.

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

The backend has ~250 tests covering core functionality. Tests use `tempfile` for isolated filesystem tests and cover:
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
- **Code Review Automation**: Integrated with Claude Code, Cursor, and Aider
- **Smart File Sorting**: AI-driven file organization with dependency analysis
- **Dependency Analysis**: Tree-sitter powered code structure understanding

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
