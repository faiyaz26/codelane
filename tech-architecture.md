# Codelane Technical Architecture

> A Rust-based AI orchestrator for local development, built with SolidJS and Tauri

## Design Principles

1. **Performance First**: Sub-500ms startup, 60+ FPS UI, minimal memory footprint
2. **Modular Architecture**: Independent crates that can be tested and evolved separately
3. **Plugin-Safe**: WASM sandboxing prevents plugins from crashing the host
4. **Cross-Platform**: Single codebase for macOS, Windows, and Linux
5. **Accessibility**: Full screen reader and IME support via WebView

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Backend Language** | Rust | Memory safety, zero-cost abstractions, no GC pauses |
| **Frontend Framework** | SolidJS 1.8+ | Fine-grained reactivity, no virtual DOM, TypeScript-first |
| **Desktop Framework** | Tauri 2.x | Rust backend, system WebView, secure IPC, small bundles |
| **Build Tool** | Vite 7+ | Fast HMR, optimized builds, ESM-native |
| **Rendering** | System WebView | WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux) |
| **Code Editor** | Monaco Editor | Full IDE features via JS interop |
| **Terminal (Backend)** | portable-pty | Cross-platform PTY: ConPTY (Win), Unix PTY |
| **Terminal (Frontend)** | xterm.js | Fast canvas renderer, full ANSI support |
| **Git** | git CLI | Reliable, well-tested, universal availability |
| **LSP** | tower-lsp | Async, tower-based, well-maintained |
| **Plugins** | wasmtime + wit-bindgen | Secure sandboxing, near-native speed |
| **Styling** | Tailwind CSS | Utility-first, customizable, small bundles |
| **Async Runtime** | tokio | Industry standard, excellent performance |
| **Serialization** | serde + toml/json | Standard Rust ecosystem |
| **Package Manager** | pnpm | Fast installs, efficient disk usage, workspace support |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Codelane                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Frontend (SolidJS + Vite)                      │   │
│  │                      Runs in System WebView                       │   │
│  │                                                                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────┐  │   │
│  │  │  Command   │ │   Theme    │ │  Keybind   │ │   Settings    │  │   │
│  │  │  Palette   │ │   System   │ │  Handler   │ │   Panel       │  │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │   Monaco    │  │  Terminal   │  │   SolidJS Components    │   │   │
│  │  │   Editor    │  │  (xterm.js) │  │   (Sidebar, Panels,     │   │   │
│  │  │             │  │             │  │    Diff View, etc.)     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 │ Tauri IPC (invoke/listen)              │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Backend (Tauri + Rust)                        │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Tauri Commands                            │  │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │  │   │
│  │  │  │   Lane    │  │ Terminal  │  │    Git    │  │   LSP    │  │  │   │
│  │  │  │  Manager  │  │   (PTY)   │  │  (CLI)    │  │  Client  │  │  │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └──────────┘  │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Plugin Runtime (WASM)                     │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │   │
│  │  │  │ Plugin A │  │ Plugin B │  │ Plugin C │  │   ...    │    │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                          Tauri Core                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Window    │  │  Clipboard  │  │ File System │  │   Shell     │    │
│  │   Manager   │  │   Manager   │  │   Access    │  │  Executor   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
codelane/
├── Cargo.toml                    # Rust workspace root
├── pnpm-workspace.yaml           # pnpm workspace configuration
├── package.json                  # Root package.json with scripts
├── Makefile                      # Common build commands
│
├── frontend/                     # SolidJS frontend (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts            # Vite + Tauri configuration
│   ├── tailwind.config.js        # Tailwind configuration
│   ├── index.html                # Entry HTML
│   ├── public/                   # Static assets
│   │   └── icons/
│   └── src/
│       ├── index.tsx             # Entry point
│       ├── App.tsx               # Root component
│       ├── index.css             # Tailwind directives
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── LaneList.tsx
│       │   ├── TerminalView.tsx
│       │   ├── EditorView.tsx
│       │   ├── DiffView.tsx
│       │   ├── ReviewPanel.tsx
│       │   ├── CommandPalette.tsx
│       │   └── StatusBar.tsx
│       ├── hooks/
│       │   ├── useTerminal.ts
│       │   ├── useMonaco.ts
│       │   └── useGit.ts
│       └── types/
│           └── tauri.ts          # Tauri command types
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri configuration
│   ├── build.rs
│   ├── icons/                    # App icons
│   ├── capabilities/             # Permission capabilities
│   │   └── default.json
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── lib.rs                # Command registration
│       ├── terminal.rs           # Terminal commands
│       ├── git.rs                # Git commands
│       └── fs.rs                 # Filesystem commands
│
├── crates/                       # Shared Rust libraries
│   ├── codelane-core/            # Core types and traits
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── lane.rs           # Lane model
│   │       ├── project.rs        # Project abstraction
│   │       └── config.rs         # Configuration types
│   │
│   ├── codelane-terminal/        # Terminal/PTY management
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── pty.rs            # PTY spawning (portable-pty)
│   │       ├── manager.rs        # Terminal lifecycle
│   │       └── tauri_bridge.rs   # Tauri command types
│   │
│   ├── codelane-git/             # Git operations
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── status.rs         # Git status (CLI)
│   │       ├── commit.rs         # Git commit (CLI)
│   │       └── diff.rs           # Git diff (CLI)
│   │
│   └── codelane-lsp/             # LSP client
│       └── src/
│           ├── lib.rs
│           ├── client.rs         # LSP client impl
│           └── manager.rs        # Server lifecycle
│
├── plugins/                      # Built-in plugins (future)
│   ├── github/
│   ├── gitlab/
│   └── theme-default/
│
└── docs/                         # Documentation
    ├── Agents.md
    ├── claude.md
    ├── TAURI_BEST_PRACTICES.md
    └── tech-architecture.md
```

---

## Monaco Editor Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Monaco Integration                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SolidJS (Frontend)                    Monaco (JavaScript)          │
│  ┌──────────────────────┐              ┌──────────────────────┐    │
│  │                      │              │                      │    │
│  │  <MonacoEditor>      │   DOM ref    │   Monaco Instance    │    │
│  │  Component           │◄─────────────│                      │    │
│  │                      │              │   - Editor state     │    │
│  │  - file_path         │   callbacks  │   - Language modes   │    │
│  │  - language          │◄─────────────│   - IntelliSense     │    │
│  │  - onChange          │              │   - Diff editor      │    │
│  │  - onSave            │              │                      │    │
│  │                      │              └──────────────────────┘    │
│  └──────────────────────┘                                           │
│           │                                                          │
│           │ Tauri invoke()                                           │
│           ▼                                                          │
│  ┌──────────────────────┐                                           │
│  │  Rust Backend        │                                           │
│  │  - LSP Manager       │                                           │
│  │  - Diagnostics       │                                           │
│  │  - Completions       │                                           │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### SolidJS Component

```typescript
import { createSignal, onMount, onCleanup } from 'solid-js';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  filePath: string;
  content: string;
  language: string;
  readonly?: boolean;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
}

export function MonacoEditor(props: MonacoEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;

  onMount(() => {
    if (!containerRef) return;

    // Initialize Monaco editor
    editor = monaco.editor.create(containerRef, {
      value: props.content,
      language: props.language,
      theme: 'vs-dark',
      readOnly: props.readonly ?? false,
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontLigatures: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
    });

    // Content change handler
    const changeDisposable = editor.onDidChangeModelContent(() => {
      const content = editor?.getValue() ?? '';
      props.onChange?.(content);
    });

    // Save handler (Ctrl+S / Cmd+S)
    const saveAction = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        const content = editor?.getValue() ?? '';
        props.onSave?.(content);
      }
    );

    // Cleanup on unmount
    onCleanup(() => {
      changeDisposable?.dispose();
      editor?.dispose();
    });
  });

  // Update content when prop changes
  createEffect(() => {
    if (editor && props.content !== editor.getValue()) {
      editor.setValue(props.content);
    }
  });

  return (
    <div
      ref={containerRef}
      class="w-full h-full min-h-[400px]"
    />
  );
}
```

### Monaco Diff Editor

```typescript
interface MonacoDiffEditorProps {
  original: string;
  modified: string;
  language: string;
  onAccept?: (modified: string) => void;
}

export function MonacoDiffEditor(props: MonacoDiffEditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let diffEditor: monaco.editor.IStandaloneDiffEditor | undefined;

  onMount(() => {
    if (!containerRef) return;

    // Create diff editor
    diffEditor = monaco.editor.createDiffEditor(containerRef, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: false,
      renderSideBySide: true,
    });

    // Set models
    const originalModel = monaco.editor.createModel(props.original, props.language);
    const modifiedModel = monaco.editor.createModel(props.modified, props.language);

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    // Cleanup
    onCleanup(() => {
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditor?.dispose();
    });
  });

  return (
    <div
      ref={containerRef}
      class="w-full h-full"
    />
  );
}
```

---

## Terminal System (xterm.js + portable-pty)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Terminal Architecture                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Rust Backend                                │ │
│  │                                                                  │ │
│  │  ┌─────────────────┐    ┌──────────────────────────────────┐   │ │
│  │  │   portable-pty  │───▶│      alacritty_terminal          │   │ │
│  │  │                 │    │                                   │   │ │
│  │  │  - ConPTY (Win) │    │  ┌─────────────┐ ┌────────────┐  │   │ │
│  │  │  - Unix PTY     │    │  │  VTE Parser │ │    Grid    │  │   │ │
│  │  │  - SSH (future) │    │  │   (vte)     │ │   State    │  │   │ │
│  │  └─────────────────┘    │  └─────────────┘ └────────────┘  │   │ │
│  │          │              │           │                       │   │ │
│  │          │ raw bytes    │           │ parsed                │   │ │
│  │          ▼              │           ▼                       │   │ │
│  │  ┌─────────────────┐    │  ┌────────────────────────────┐  │   │ │
│  │  │   Read Loop     │────┼─▶│   Term<EventListener>      │  │   │ │
│  │  │   (tokio task)  │    │  │   - advance_bytes()        │  │   │ │
│  │  └─────────────────┘    │  │   - renderable_content()   │  │   │ │
│  │                         │  └────────────────────────────┘  │   │ │
│  │                         └──────────────────────────────────┘   │ │
│  │                                      │                          │ │
│  │                                      │ RenderableContent        │ │
│  │                                      ▼                          │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                  Render State Manager                     │  │ │
│  │  │  - Dirty region tracking                                  │  │ │
│  │  │  - Diff computation (only changed cells)                  │  │ │
│  │  │  - Frame batching (60 FPS cap)                           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────┬──────────────────────┘ │
│                                            │                        │
│                                            │ JSON (cell updates)    │
│                                            ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      WebView                                     ││
│  │                                                                  ││
│  │  ┌────────────────────────────────────────────────────────────┐ ││
│  │  │              Canvas/WebGL Terminal Renderer                 │ ││
│  │  │                                                             │ ││
│  │  │  - Glyph atlas caching                                     │ ││
│  │  │  - Incremental cell updates                                │ ││
│  │  │  - Selection overlay                                       │ ││
│  │  │  - Cursor rendering                                        │ ││
│  │  │  - 60 FPS render loop                                      │ ││
│  │  └────────────────────────────────────────────────────────────┘ ││
│  │                                                                  ││
│  │  ┌────────────────────────────────────────────────────────────┐ ││
│  │  │                    Input Handler                            │ ││
│  │  │  - Keyboard → PTY                                          │ ││
│  │  │  - Mouse → PTY (if enabled)                                │ ││
│  │  │  - Paste (bracketed paste mode)                            │ ││
│  │  │  - Resize events                                           │ ││
│  │  └────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Terminal Backend (Tauri Commands)

```rust
use alacritty_terminal::term::{Term, Config as TermConfig};
use alacritty_terminal::event::{Event, EventListener};
use alacritty_terminal::grid::Dimensions;
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty};
use tokio::sync::mpsc;
use parking_lot::Mutex;
use std::sync::Arc;

pub struct Terminal {
    id: TerminalId,
    term: Arc<Mutex<Term<Listener>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    size: TerminalSize,
    event_tx: mpsc::UnboundedSender<TerminalEvent>,
}

pub struct Listener {
    event_tx: mpsc::UnboundedSender<TerminalEvent>,
}

impl EventListener for Listener {
    fn send_event(&self, event: Event) {
        let _ = self.event_tx.send(TerminalEvent::Alacritty(event));
    }
}

impl Terminal {
    pub fn spawn(
        shell: &str,
        working_dir: &Path,
        env: &[(String, String)],
        size: TerminalSize,
    ) -> Result<Self> {
        let id = TerminalId::new();
        let (event_tx, event_rx) = mpsc::unbounded_channel();

        // Create PTY
        let pty_system = native_pty_system();
        let pty_size = PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        };
        let pair = pty_system.openpty(pty_size)?;

        // Spawn shell
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(working_dir);
        for (key, value) in env {
            cmd.env(key, value);
        }
        let _child = pair.slave.spawn_command(cmd)?;

        // Create alacritty terminal
        let config = TermConfig::default();
        let dimensions = TerminalDimensions { cols: size.cols, rows: size.rows };
        let listener = Listener { event_tx: event_tx.clone() };
        let term = Term::new(config, &dimensions, listener);

        let master = Arc::new(Mutex::new(pair.master));
        let term = Arc::new(Mutex::new(term));

        // Spawn read loop
        let term_clone = term.clone();
        let master_clone = master.clone();
        let event_tx_clone = event_tx.clone();

        tokio::spawn(async move {
            let mut reader = master_clone.lock().try_clone_reader().unwrap();
            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let mut term = term_clone.lock();
                        term.advance_bytes(&buf[..n]);
                        let _ = event_tx_clone.send(TerminalEvent::Redraw);
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            id,
            term,
            master,
            size,
            event_tx,
        })
    }

    pub fn write(&self, data: &[u8]) -> Result<()> {
        let mut writer = self.master.lock().take_writer()?;
        writer.write_all(data)?;
        Ok(())
    }

    pub fn resize(&mut self, size: TerminalSize) -> Result<()> {
        self.size = size;

        // Resize PTY
        self.master.lock().resize(PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        // Resize terminal state
        let dimensions = TerminalDimensions {
            cols: size.cols,
            rows: size.rows
        };
        self.term.lock().resize(dimensions);

        Ok(())
    }

    pub fn get_render_state(&self) -> TerminalRenderState {
        let term = self.term.lock();
        let content = term.renderable_content();

        TerminalRenderState {
            cells: content.display_iter
                .map(|cell| RenderCell {
                    x: cell.point.column.0,
                    y: cell.point.line.0,
                    c: cell.cell.c.to_string(),
                    fg: color_to_css(cell.fg),
                    bg: color_to_css(cell.bg),
                    flags: cell.cell.flags.bits(),
                })
                .collect(),
            cursor: CursorState {
                x: content.cursor.point.column.0,
                y: content.cursor.point.line.0,
                shape: cursor_shape_to_string(content.cursor.shape),
                visible: !content.cursor.is_hidden,
            },
            size: self.size,
        }
    }
}

#[derive(Serialize)]
pub struct TerminalRenderState {
    pub cells: Vec<RenderCell>,
    pub cursor: CursorState,
    pub size: TerminalSize,
}

#[derive(Serialize)]
pub struct RenderCell {
    pub x: usize,
    pub y: usize,
    pub c: String,
    pub fg: String,
    pub bg: String,
    pub flags: u16,
}
```

### SolidJS Terminal Component

```typescript
import { createSignal, onMount, onCleanup } from 'solid-js';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

#[component]
pub fn TerminalView(
    terminal_id: TerminalId,
    terminal: Signal<Terminal>,
) -> Element {
    let container_id = use_signal(|| format!("terminal-{}", terminal_id));
    let render_state = use_signal(|| None::<TerminalRenderState>);

    // Initialize canvas renderer
    use_effect(move || {
        let id = container_id.read().clone();

        document::eval(&format!(r#"
            (function() {{
                const container = document.getElementById('{id}');
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);

                window.terminalRenderers = window.terminalRenderers || {{}};
                window.terminalRenderers['{id}'] = new TerminalRenderer(canvas, {{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    theme: {{
                        background: '#1e1e1e',
                        foreground: '#d4d4d4',
                        cursor: '#ffffff',
                    }}
                }});
            }})();
        "#));
    });

    // Subscribe to terminal updates
    use_effect(move || {
        let term = terminal.read();
        let state = term.get_render_state();
        render_state.set(Some(state));
    });

    // Render when state changes
    use_effect(move || {
        if let Some(state) = render_state.read().as_ref() {
            let id = container_id.read().clone();
            let json = serde_json::to_string(state).unwrap();

            document::eval(&format!(r#"
                window.terminalRenderers['{id}']?.render({json});
            "#));
        }
    });

    // Handle keyboard input
    let on_keydown = move |evt: KeyboardEvent| {
        let key_data = encode_key_event(&evt);
        terminal.read().write(key_data.as_bytes()).ok();
        evt.prevent_default();
    };

    // Handle paste
    let on_paste = move |evt: ClipboardEvent| {
        if let Some(text) = evt.data() {
            // Bracketed paste mode
            let bracketed = format!("\x1b[200~{}\x1b[201~", text);
            terminal.read().write(bracketed.as_bytes()).ok();
        }
        evt.prevent_default();
    };

    rsx! {
        div {
            id: "{container_id}",
            class: "terminal-container w-full h-full focus:outline-none",
            tabindex: "0",
            onkeydown: on_keydown,
            onpaste: on_paste,
        }
    }
}

fn encode_key_event(evt: &KeyboardEvent) -> String {
    // Convert web key events to terminal escape sequences
    match evt.key().as_str() {
        "Enter" => "\r".to_string(),
        "Backspace" => "\x7f".to_string(),
        "Tab" => "\t".to_string(),
        "Escape" => "\x1b".to_string(),
        "ArrowUp" => "\x1b[A".to_string(),
        "ArrowDown" => "\x1b[B".to_string(),
        "ArrowRight" => "\x1b[C".to_string(),
        "ArrowLeft" => "\x1b[D".to_string(),
        key if key.len() == 1 => {
            if evt.ctrl_key() {
                // Ctrl+key
                let c = key.chars().next().unwrap();
                let ctrl_code = (c.to_ascii_lowercase() as u8) - b'a' + 1;
                String::from_utf8(vec![ctrl_code]).unwrap()
            } else {
                key.to_string()
            }
        }
        _ => String::new(),
    }
}
```

### WebGL Terminal Renderer (JavaScript)

```javascript
// assets/terminal.js

class TerminalRenderer {
    constructor(canvas, options) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            ...options
        };

        this.charWidth = 0;
        this.charHeight = 0;
        this.glyphCache = new Map();

        this.measureFont();
        this.setupCanvas();
    }

    measureFont() {
        this.ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
        const metrics = this.ctx.measureText('M');
        this.charWidth = metrics.width;
        this.charHeight = this.options.fontSize * 1.2;
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);
        this.ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    }

    render(state) {
        const { cells, cursor, size } = state;

        // Clear canvas
        this.ctx.fillStyle = this.options.theme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Render cells
        for (const cell of cells) {
            this.renderCell(cell);
        }

        // Render cursor
        if (cursor.visible) {
            this.renderCursor(cursor);
        }
    }

    renderCell(cell) {
        const x = cell.x * this.charWidth;
        const y = cell.y * this.charHeight;

        // Background
        if (cell.bg !== 'transparent') {
            this.ctx.fillStyle = cell.bg;
            this.ctx.fillRect(x, y, this.charWidth, this.charHeight);
        }

        // Character
        if (cell.c && cell.c !== ' ') {
            this.ctx.fillStyle = cell.fg;
            this.ctx.fillText(cell.c, x, y + this.charHeight - 4);
        }
    }

    renderCursor(cursor) {
        const x = cursor.x * this.charWidth;
        const y = cursor.y * this.charHeight;

        this.ctx.fillStyle = this.options.theme.cursor;

        switch (cursor.shape) {
            case 'block':
                this.ctx.globalAlpha = 0.7;
                this.ctx.fillRect(x, y, this.charWidth, this.charHeight);
                this.ctx.globalAlpha = 1.0;
                break;
            case 'underline':
                this.ctx.fillRect(x, y + this.charHeight - 2, this.charWidth, 2);
                break;
            case 'beam':
                this.ctx.fillRect(x, y, 2, this.charHeight);
                break;
        }
    }

    resize(cols, rows) {
        this.setupCanvas();
    }
}

// Export for use
window.TerminalRenderer = TerminalRenderer;
```

---

## State Management

Using SolidJS signals and context for reactive state management:

```typescript
import { createSignal, createContext, useContext, ParentComponent } from 'solid-js';

// Types from Tauri backend
interface Lane {
  id: string;
  name: string;
  workingDir: string;
  terminalId?: string;
}

interface AppState {
  lanes: () => Lane[];
  setLanes: (lanes: Lane[]) => void;
  activeLaneId: () => string | null;
  setActiveLaneId: (id: string | null) => void;
  theme: () => 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

// Create context
const AppContext = createContext<AppState>();

// Provider component
export const AppProvider: ParentComponent = (props) => {
  const [lanes, setLanes] = createSignal<Lane[]>([]);
  const [activeLaneId, setActiveLaneId] = createSignal<string | null>(null);
  const [theme, setTheme] = createSignal<'dark' | 'light'>('dark');

  const state: AppState = {
    lanes,
    setLanes,
    activeLaneId,
    setActiveLaneId,
    theme,
    setTheme,
  };

  return (
    <AppContext.Provider value={state}>
      {props.children}
    </AppContext.Provider>
  );
};

// Hook to consume state
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

// Example: App component with provider
function App() {
  return (
    <AppProvider>
      <div class="app-container h-screen flex flex-col bg-gray-900 text-gray-100">
        <TitleBar />
        <div class="flex-1 flex overflow-hidden">
          <Sidebar />
          <MainContent />
        </div>
        <StatusBar />
      </div>
    </AppProvider>
  );
}

// Example: Consuming state in a component
function Sidebar() {
  const { lanes, setActiveLaneId } = useAppState();

  const createNewLane = async () => {
    // Tauri command to create lane
    await invoke('lane_create', { name: 'New Lane' });
    // Refresh lanes list
  };

  return (
    <aside class="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div class="p-4 border-b border-gray-700">
        <h2 class="text-sm font-semibold text-gray-400 uppercase">Lanes</h2>
      </div>
      <div class="flex-1 overflow-y-auto">
        <For each={lanes()}>
          {(lane) => (
            <LaneItem
              lane={lane}
              onClick={() => setActiveLaneId(lane.id)}
            />
          )}
        </For>
      </div>
      <button
        class="m-4 p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        onClick={createNewLane}
      >
        + New Lane
      </button>
    </aside>
  );
}
```

---

## Data Flow

```
User Input (Keyboard/Mouse)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                  SolidJS Event Handler                       │
│  (onClick, onInput, onKeyDown, etc.)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Command   │     │   Direct    │     │   JS Libraries  │
│   Palette   │     │   Action    │     │  (Monaco/xterm) │
└──────┬──────┘     └──────┬──────┘     └────────┬────────┘
       │                   │                      │
       └───────────────────┼──────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Tauri Invoke         │
              │   (IPC to Backend)      │
              └────────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Terminal   │    │     Git     │    │    Lane     │
│  Commands   │    │  Commands   │    │  Commands   │
│   (Rust)    │    │   (Rust)    │    │   (Rust)    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   Tauri Event        │
              │  (IPC to Frontend)   │
              └──────────┬───────────┘
                         │
                         ▼
                ┌────────────────────┐
                │  SolidJS Signal    │
                │  Update (reactive) │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  Fine-grained      │
                │  DOM Update        │
                │  (no VDOM)         │
                └────────────────────┘
```

---

## Plugin System (WASM)

### Plugin Manifest

```toml
# plugin.toml
[plugin]
name = "github"
version = "0.1.0"
description = "GitHub integration for Codelane"
entry = "plugin.wasm"

[capabilities]
git_provider = { domain = "github.com" }
commands = ["gh:pr:create", "gh:pr:list", "gh:issue:create"]

[permissions]
network = ["api.github.com"]
```

### WIT Interface

```wit
// codelane.wit
package codelane:plugin@0.1.0;

interface host {
    // Logging
    log: func(level: log-level, message: string);

    // Notifications
    notify: func(message: string, level: notification-level);

    // File operations (sandboxed to workspace)
    read-file: func(path: string) -> result<list<u8>, error>;
    write-file: func(path: string, content: list<u8>) -> result<_, error>;

    // Editor integration
    get-active-file: func() -> option<string>;
    get-selection: func() -> option<text-range>;
    insert-text: func(text: string) -> result<_, error>;

    // Git integration
    get-repo-root: func() -> option<string>;
    get-current-branch: func() -> option<string>;

    // HTTP (if permitted)
    http-request: func(request: http-request) -> result<http-response, error>;
}

interface plugin {
    // Lifecycle
    activate: func() -> result<_, error>;
    deactivate: func();

    // Commands
    execute-command: func(command: string, args: list<string>) -> result<_, error>;

    // Events
    on-file-open: func(path: string);
    on-file-save: func(path: string);
    on-git-commit: func(hash: string, message: string);
}

world codelane-plugin {
    import host;
    export plugin;
}
```

---

## Build & Development

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "productName": "Codelane",
  "version": "0.1.0",
  "identifier": "dev.codelane.app",
  "build": {
    "beforeDevCommand": "pnpm dev --host",
    "beforeBuildCommand": "pnpm build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../frontend/dist"
  },
  "app": {
    "windows": [{
      "title": "Codelane",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600,
      "resizable": true,
      "fullscreen": false
    }],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:",
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      },
      "freezePrototype": true
    }
  },
  "bundle": {
    "active": true,
    "category": "DeveloperTool",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

### Vite Configuration

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 1421,
    },
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
          xterm: ['xterm', 'xterm-addon-fit'],
        },
      },
    },
  },
});
```

### Development Commands

```bash
# Install dependencies (frontend + Tauri CLI)
pnpm install

# Development with hot reload
pnpm dev
# or
make dev

# Frontend only (for UI work)
cd frontend && pnpm dev

# Build release
pnpm build
# or
make build

# Run tests
cargo test --workspace
make test

# Code quality
cargo fmt --all
cargo clippy --workspace -- -D warnings
make fmt
make lint

# Clean build artifacts
make clean
```

### CI/CD Pipeline

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-latest
            target: universal-apple-darwin
            artifact: codelane-macos
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: codelane-windows-x64
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact: codelane-linux-x64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install dependencies
        run: pnpm install

      - name: Build frontend
        run: pnpm build --filter frontend

      - name: Build Tauri app
        run: pnpm tauri build --target ${{ matrix.target }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: src-tauri/target/release/bundle/
```

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **Startup time** | < 500ms | Lazy loading, minimal initial DOM |
| **Memory (idle)** | < 150MB | WebView efficiency, Rust backend |
| **Terminal latency** | < 16ms | alacritty parsing, batched rendering |
| **Editor response** | < 50ms | Monaco's built-in optimizations |
| **File open (1MB)** | < 100ms | Streaming, Monaco's text buffer |
| **Git status** | < 200ms | gitoxide, background refresh |

---

## Security Model

### WebView Isolation
- JavaScript runs in WebView sandbox
- Rust backend handles all system operations
- IPC via `document::eval()` and `dioxus.send()`

### Plugin Sandboxing
- WASM linear memory isolation
- Capability-based permissions
- Network access requires explicit permission
- Filesystem scoped to workspace

### Credential Storage
- OS keychain integration (keyring crate)
- No plaintext credential storage
- Environment variable support for CI/CD

---

## Future Considerations

### Phase 2 Enhancements
- Remote development (SSH lanes)
- Collaborative editing (CRDT)
- AI agent orchestration improvements

### Native Renderer (Optional)
If WebView performance becomes a bottleneck:
- Explore Tauri's custom protocol for optimized asset loading
- Consider GPU-accelerated canvas rendering for terminal
- Profile and optimize xterm.js configuration
- Investigate WebGPU for intensive rendering tasks

### Mobile Support (Future)
- Tauri supports mobile platforms (iOS/Android) in v2+
- Would require touch-optimized UI redesign
- Remote lane connections via SSH/websocket
- Simplified feature set for mobile form factor
