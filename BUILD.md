# Codelane Build Guide

## Prerequisites

### Required Tools

1. **Rust** (1.75 or later)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

2. **Node.js** (18 or later)
   ```bash
   # Using nvm (recommended)
   nvm install 18
   nvm use 18
   ```

3. **Tauri CLI**
   ```bash
   cargo install tauri-cli
   ```

4. **Dioxus CLI**
   ```bash
   cargo install dioxus-cli
   ```

5. **Platform-specific dependencies**

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Linux (Ubuntu/Debian):**
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

   **Windows:**
   - Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Quick Start

```bash
# Install dependencies
make install

# Start development server
make dev
```

## Development Workflow

### Running in Development Mode

```bash
# Full development mode (Tauri + hot reload)
make dev

# Or using npm
npm run dev
```

This starts:
- Tauri dev server with hot module replacement
- Automatic rebuild on Rust code changes
- Dioxus hot reloading for UI changes

### Running Tailwind CSS

In a separate terminal:
```bash
make tailwind
# Or
npm run tailwind:watch
```

### Running Frontend Only

For faster iteration on UI:
```bash
make frontend
# Or
npm run frontend:dev
```

## Build Commands

### Development Build

```bash
cargo build
```

### Release Build

```bash
make build
# Or
npm run build
```

This produces optimized binaries in `src-tauri/target/release/`.

### Platform-Specific Builds

```bash
# macOS Universal Binary
make build-macos

# Linux
make build-linux

# Windows
make build-windows
```

## Code Quality

```bash
# Check code without building
make check

# Run tests
make test

# Format code
make fmt

# Run lints
make lint
```

## Project Structure

```
codelane/
├── crates/              # Rust workspace crates
│   ├── codelane/        # Main Dioxus application
│   ├── codelane-core/   # Core functionality
│   ├── codelane-ui/     # UI components
│   └── ...
├── src-tauri/           # Tauri backend
│   ├── src/             # Rust source
│   ├── tauri.conf.json  # Tauri configuration
│   └── build.rs         # Build script
├── assets/              # Static assets
├── Cargo.toml           # Workspace configuration
├── package.json         # Node.js scripts
├── Makefile             # Build automation
└── tailwind.config.js   # Tailwind CSS configuration
```

## Troubleshooting

### Common Issues

**Build fails with missing dependencies:**
```bash
make install
```

**Hot reload not working:**
- Ensure `dx` CLI is installed: `cargo install dioxus-cli`
- Check that file watchers are running

**Tailwind styles not updating:**
```bash
npm run tailwind:build
```

**WASM compilation errors:**
```bash
rustup target add wasm32-unknown-unknown
```

### Clean Build

```bash
make clean
make install
make build
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RUST_LOG` | Log level | `info` |
| `RUST_BACKTRACE` | Show backtraces | `1` |

## Performance Tips

1. **Faster incremental builds:** The project uses optimized dev profile settings
2. **Parallel compilation:** Uses all available CPU cores
3. **LTO in release:** Link-time optimization is enabled for release builds

## Useful Aliases

Add to your shell configuration:

```bash
alias cl="cd /path/to/codelane && make dev"
alias clb="cd /path/to/codelane && make build"
alias clt="cd /path/to/codelane && make test"
```
