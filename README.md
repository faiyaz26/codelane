<div align="center">
  <img src="assets/icons/codelane_logo.png" alt="Codelane Logo" width="120" height="120">
  <h1>Codelane</h1>
  <p><strong>Agentic Development Environment</strong> - A modern desktop application that enables parallel feature development across multiple project lanes with AI agents and human-in-the-loop code review.</p>
  <p><a href="https://codelane.app">codelane.app</a></p>
</div>

Built on Tauri and SolidJS for exceptional performance, Codelane empowers developers to work on multiple tasks simultaneously while maintaining control through intelligent code review, dependency-aware navigation, and comprehensive git management.

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite
- **Backend**: Rust + Tauri 2.x
- **Styling**: Tailwind CSS
- **Terminal**: portable-pty + xterm.js
- **Highlighter**: Shiki
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

# Output in target/release/bundle/
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
│  │  • Code Viewer (Shiki)                    │  │
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
- **Multiple AI Agents**: Configure different agents per lane with model selection
  - **Claude Code**: Use Claude models (Opus, Sonnet, Haiku) via Anthropic API
  - **Aider**: Local or API-based models (GPT-4, Claude, local LLMs via Ollama)
  - **OpenCode/Cursor**: Your choice of supported models
  - **Custom Shell**: Run any CLI-based AI coding assistant

> **Note**: Codelane is an orchestration tool - you'll need to configure your preferred AI service (API keys, local models, etc.) separately. The application provides the terminal environment where these agents run.

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
- **Cross-platform**: Only macOS is fully tested. Windows and Linux versions are experimental and untested.

## Troubleshooting

### Build fails with missing dependencies
```bash
pnpm install
```

### Windows: Tauri CLI native binding errors
If you see errors like `Cannot find module '@tauri-apps/cli-win32-x64-msvc'`:

**PowerShell:**
```powershell
# Remove existing installations
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml

# Reinstall with proper hoisting
pnpm install
```

**Git Bash / WSL:**
```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

The root `.npmrc` file enables `shamefully-hoist=true` which is required for Tauri CLI to work correctly on Windows.

### Windows: Make commands not working
On Windows, use PowerShell or install [Make for Windows](https://gnuwin32.sourceforge.net/packages/make.htm), or use pnpm scripts directly:

```bash
# Instead of 'make dev'
pnpm dev

# Instead of 'make build'
pnpm build
```

### Hot reload not working
- Check that port 1420 is not in use
- Restart the dev server: `make dev` or `pnpm dev`

### Clean build from scratch
```bash
make clean
pnpm install
make build
```

## FAQ

### Which AI model should I use with Codelane?

Codelane is an **orchestration tool** that provides the environment for AI coding agents to run. It doesn't include AI models itself. You have several options:

1. **Cloud-based models (API)**:
   - **Anthropic Claude** (via Claude Code or Aider): Requires API key from [console.anthropic.com](https://console.anthropic.com)
   - **OpenAI GPT-4** (via Aider, Cursor): Requires API key from [platform.openai.com](https://platform.openai.com)
   
2. **Local models** (free, runs on your machine):
   - Install [Ollama](https://ollama.com) - download from their website for your platform
   - Popular coding models: `qwen2.5-coder`, `deepseek-coder`, `codellama`, `starcoder2`
   - Use with Aider: `aider --model ollama/qwen2.5-coder`
   - Check [ollama.com/library](https://ollama.com/library) for latest model names and sizes

3. **Hybrid approach**:
   - Use local models for exploration/drafts
   - Use Claude/GPT-4 for complex refactoring

**Recommendation**: For a free, privacy-focused setup without API costs, start with **Ollama + Aider**. Configure it in the lane settings once installed.

### How do I set up Aider with local models?

See the "Local models" option above for Ollama installation. Quick example:

```bash
# Pull a coding model (after installing Ollama)
ollama pull qwen2.5-coder:7b

# In Codelane terminal, use Aider with the local model
aider --model ollama/qwen2.5-coder:7b
```

### How do I configure Claude Code?

1. Get API key from [console.anthropic.com](https://console.anthropic.com)
2. Set environment variable: `export ANTHROPIC_API_KEY=your_key`
3. In lane settings, select "Claude Code" and choose model (Sonnet, Opus, Haiku)

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- You are free to use, modify, and distribute this software
- Any modifications or forks **must also be open source** under AGPL-3.0
- If you run a modified version as a network service, you must share the source code

See [LICENSE](LICENSE) for the full license text.

### Commercial Licensing

If you wish to use Codelane in a proprietary product, build closed-source premium features, or need a license without copyleft obligations, a commercial license is available.

Contact **faiyaz26@gmail.com** for commercial licensing inquiries.
