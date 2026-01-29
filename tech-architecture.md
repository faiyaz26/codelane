# Codelane Technical Architecture

> A Rust-based AI orchestrator for local development, built with Dioxus and WebView

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
| **Language** | Rust | Memory safety, zero-cost abstractions, no GC pauses |
| **UI Framework** | Dioxus 0.7+ | Pure Rust, React-like DX, WebView rendering |
| **Rendering** | System WebView | WKWebView (macOS), WebView2 (Windows), WebKitGTK (Linux) |
| **Code Editor** | Monaco Editor | Full IDE features via JS interop |
| **Terminal** | alacritty_terminal + portable-pty | Native Rust parsing, cross-platform PTY |
| **Terminal Render** | Canvas/WebGL | Custom renderer for alacritty grid state |
| **Git** | gitoxide | Pure Rust, no C dependencies |
| **LSP** | tower-lsp | Async, tower-based, well-maintained |
| **Syntax** | tree-sitter | Incremental parsing (for non-Monaco views) |
| **Plugins** | wasmtime + wit-bindgen | Secure sandboxing, near-native speed |
| **Styling** | Tailwind CSS | Integrated with Dioxus CLI |
| **Async Runtime** | tokio | Industry standard, excellent performance |
| **Serialization** | serde + toml/json | Standard Rust ecosystem |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Codelane                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Dioxus Application                            │   │
│  │                                                                    │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────┐  │   │
│  │  │  Command   │ │   Theme    │ │  Keybind   │ │   Settings    │  │   │
│  │  │  Palette   │ │   Engine   │ │  Manager   │ │   Manager     │  │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └───────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Core Services (Rust)                      │  │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  │  │   │
│  │  │  │   Lane    │  │ Terminal  │  │    Git    │  │   LSP    │  │  │   │
│  │  │  │  Manager  │  │  Manager  │  │  Manager  │  │  Client  │  │  │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └──────────┘  │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Plugin Runtime (WASM)                     │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │   │
│  │  │  │ Plugin A │  │ Plugin B │  │ Plugin C │  │   ...    │    │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                        │                                 │
│  ┌─────────────────────────────────────▼────────────────────────────┐   │
│  │                         WebView Layer                             │   │
│  │                                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │   Monaco    │  │  Terminal   │  │      Dioxus RSX         │   │   │
│  │  │   Editor    │  │  Renderer   │  │   (Sidebar, Panels,     │   │   │
│  │  │  (JS Interop)│  │ (Canvas)   │  │    Diff View, etc.)     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                          Platform Layer (wry + tao)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Window    │  │  Clipboard  │  │ File System │  │   Process   │    │
│  │   System    │  │   Manager   │  │   Watcher   │  │   Spawner   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Crate Structure

```
codelane/
├── Cargo.toml                    # Workspace root
├── Dioxus.toml                   # Dioxus CLI configuration
├── Tailwind.config.js            # Tailwind configuration
│
├── crates/
│   ├── codelane/                 # Main binary crate
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── app.rs            # Root Dioxus component
│   │   │   └── routes.rs         # Application routes
│   │   └── assets/
│   │       ├── index.html        # HTML template
│   │       ├── monaco.js         # Monaco loader
│   │       ├── terminal.js       # Terminal renderer
│   │       └── styles.css        # Tailwind output
│   │
│   ├── codelane-core/            # Core types and traits
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── lane.rs           # Lane model
│   │       ├── project.rs        # Project abstraction
│   │       └── config.rs         # Configuration types
│   │
│   ├── codelane-terminal/        # Terminal emulation
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── pty.rs            # PTY management (portable-pty)
│   │       ├── term.rs           # Terminal state (alacritty_terminal)
│   │       ├── event.rs          # Terminal events
│   │       └── renderer.rs       # Grid to render data conversion
│   │
│   ├── codelane-editor/          # Editor integration
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── monaco.rs         # Monaco JS bridge types
│   │       ├── commands.rs       # Editor commands
│   │       └── lsp_bridge.rs     # LSP to Monaco adapter
│   │
│   ├── codelane-git/             # Git integration
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── repository.rs     # Repo operations (gitoxide)
│   │       ├── diff.rs           # Diff computation
│   │       ├── status.rs         # Status tracking
│   │       └── explain.rs        # AI-powered explanations
│   │
│   ├── codelane-review/          # Code review engine
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── review.rs         # Review model
│   │       ├── comment.rs        # Inline comments
│   │       └── checklist.rs      # Review checklist
│   │
│   ├── codelane-lsp/             # LSP client
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── client.rs         # LSP client impl
│   │       ├── manager.rs        # Server lifecycle
│   │       └── diagnostics.rs    # Diagnostic handling
│   │
│   ├── codelane-ui/              # Dioxus UI components
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── components/
│   │       │   ├── mod.rs
│   │       │   ├── sidebar.rs
│   │       │   ├── lane_list.rs
│   │       │   ├── pane.rs
│   │       │   ├── terminal_view.rs
│   │       │   ├── editor_view.rs
│   │       │   ├── diff_view.rs
│   │       │   ├── review_panel.rs
│   │       │   ├── command_palette.rs
│   │       │   └── status_bar.rs
│   │       ├── hooks/
│   │       │   ├── mod.rs
│   │       │   ├── use_terminal.rs
│   │       │   ├── use_monaco.rs
│   │       │   └── use_git.rs
│   │       └── theme.rs
│   │
│   ├── codelane-plugin/          # Plugin host
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── host.rs           # WASM host (wasmtime)
│   │       ├── manifest.rs       # Plugin manifest
│   │       └── api.rs            # Plugin API (WIT)
│   │
│   └── codelane-plugin-api/      # Plugin SDK (published)
│       └── src/
│           └── lib.rs
│
├── assets/                        # Static assets
│   ├── fonts/
│   ├── icons/
│   └── themes/
│
├── plugins/                       # Built-in plugins
│   ├── github/
│   ├── gitlab/
│   └── theme-default/
│
└── xtask/                         # Build tooling
    └── src/
        └── main.rs
```

---

## Monaco Editor Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Monaco Integration                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Rust (Dioxus)                         WebView (JavaScript)         │
│  ┌──────────────────────┐              ┌──────────────────────┐    │
│  │                      │              │                      │    │
│  │  MonacoEditor        │   document   │   Monaco Instance    │    │
│  │  Component           │◄───eval()───►│                      │    │
│  │                      │              │   - Editor state     │    │
│  │  - file_path         │   dioxus     │   - Language modes   │    │
│  │  - language          │◄───.send()───│   - IntelliSense     │    │
│  │  - on_change         │              │   - Diff editor      │    │
│  │  - on_save           │              │                      │    │
│  │                      │              └──────────────────────┘    │
│  └──────────────────────┘                                           │
│           │                                                          │
│           ▼                                                          │
│  ┌──────────────────────┐                                           │
│  │   LSP Manager        │                                           │
│  │   - Diagnostics      │                                           │
│  │   - Completions      │                                           │
│  │   - Hover info       │                                           │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Dioxus Component

```rust
use dioxus::prelude::*;

#[derive(Props, Clone, PartialEq)]
pub struct MonacoEditorProps {
    pub file_path: String,
    pub content: String,
    pub language: String,
    #[props(default)]
    pub readonly: bool,
    pub on_change: EventHandler<String>,
    pub on_save: EventHandler<String>,
}

#[component]
pub fn MonacoEditor(props: MonacoEditorProps) -> Element {
    let editor_id = use_signal(|| uuid::Uuid::new_v4().to_string());

    // Initialize Monaco on mount
    use_effect(move || {
        let id = editor_id.read().clone();
        let content = props.content.clone();
        let language = props.language.clone();
        let readonly = props.readonly;

        spawn(async move {
            // Initialize Monaco editor
            let init_script = format!(r#"
                (function() {{
                    const container = document.getElementById('{id}');
                    if (!container || window.monacoEditors?.['{id}']) return;

                    window.monacoEditors = window.monacoEditors || {{}};

                    const editor = monaco.editor.create(container, {{
                        value: {content},
                        language: '{language}',
                        theme: 'vs-dark',
                        readOnly: {readonly},
                        automaticLayout: true,
                        minimap: {{ enabled: true }},
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontLigatures: true,
                        scrollBeyondLastLine: false,
                        renderWhitespace: 'selection',
                        bracketPairColorization: {{ enabled: true }},
                    }});

                    window.monacoEditors['{id}'] = editor;

                    // Content change handler
                    editor.onDidChangeModelContent(() => {{
                        dioxus.send(JSON.stringify({{
                            type: 'change',
                            editorId: '{id}',
                            content: editor.getValue()
                        }}));
                    }});

                    // Save handler (Ctrl+S / Cmd+S)
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {{
                        dioxus.send(JSON.stringify({{
                            type: 'save',
                            editorId: '{id}',
                            content: editor.getValue()
                        }}));
                    }});
                }})();
            "#,
                content = serde_json::to_string(&content).unwrap(),
                readonly = if readonly { "true" } else { "false" },
            );

            let eval = document::eval(&init_script);

            // Listen for events from Monaco
            while let Ok(msg) = eval.recv::<String>().await {
                if let Ok(event) = serde_json::from_str::<MonacoEvent>(&msg) {
                    match event.event_type.as_str() {
                        "change" => props.on_change.call(event.content),
                        "save" => props.on_save.call(event.content),
                        _ => {}
                    }
                }
            }
        });
    });

    rsx! {
        div {
            id: "{editor_id}",
            class: "w-full h-full min-h-[400px]",
        }
    }
}

#[derive(Deserialize)]
struct MonacoEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(rename = "editorId")]
    editor_id: String,
    content: String,
}
```

### Monaco Diff Editor

```rust
#[component]
pub fn MonacoDiffEditor(
    original: String,
    modified: String,
    language: String,
    on_accept: EventHandler<String>,
) -> Element {
    let editor_id = use_signal(|| uuid::Uuid::new_v4().to_string());

    use_effect(move || {
        let id = editor_id.read().clone();

        spawn(async move {
            let script = format!(r#"
                (function() {{
                    const container = document.getElementById('{id}');

                    const diffEditor = monaco.editor.createDiffEditor(container, {{
                        theme: 'vs-dark',
                        automaticLayout: true,
                        readOnly: false,
                        renderSideBySide: true,
                    }});

                    diffEditor.setModel({{
                        original: monaco.editor.createModel({original}, '{language}'),
                        modified: monaco.editor.createModel({modified}, '{language}'),
                    }});

                    window.monacoDiffEditors = window.monacoDiffEditors || {{}};
                    window.monacoDiffEditors['{id}'] = diffEditor;
                }})();
            "#,
                original = serde_json::to_string(&original).unwrap(),
                modified = serde_json::to_string(&modified).unwrap(),
            );

            document::eval(&script);
        });
    });

    rsx! {
        div {
            id: "{editor_id}",
            class: "w-full h-full",
        }
    }
}
```

---

## Terminal System (alacritty_terminal)

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

### Terminal Manager (Rust)

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

### Dioxus Terminal Component

```rust
use dioxus::prelude::*;
use crate::terminal::{Terminal, TerminalRenderState, TerminalSize};

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

Using Dioxus signals with context providers:

```rust
use dioxus::prelude::*;

// Global application state
#[derive(Clone)]
pub struct AppState {
    pub lanes: Signal<Vec<Lane>>,
    pub active_lane_id: Signal<Option<LaneId>>,
    pub terminals: Signal<HashMap<TerminalId, Terminal>>,
    pub theme: Signal<Theme>,
    pub settings: Signal<Settings>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            lanes: Signal::new(Vec::new()),
            active_lane_id: Signal::new(None),
            terminals: Signal::new(HashMap::new()),
            theme: Signal::new(Theme::default()),
            settings: Signal::new(Settings::load().unwrap_or_default()),
        }
    }

    // Derived state
    pub fn active_lane(&self) -> Option<Lane> {
        let id = self.active_lane_id.read();
        id.as_ref().and_then(|id| {
            self.lanes.read().iter().find(|l| l.id == *id).cloned()
        })
    }
}

// Context provider at app root
fn App() -> Element {
    let state = use_context_provider(|| AppState::new());

    rsx! {
        div { class: "app-container h-screen flex flex-col bg-gray-900 text-gray-100",
            TitleBar {}
            div { class: "flex-1 flex overflow-hidden",
                Sidebar {}
                MainContent {}
            }
            StatusBar {}
        }
    }
}

// Consuming state in components
#[component]
fn Sidebar() -> Element {
    let state = use_context::<AppState>();
    let lanes = state.lanes.read();

    rsx! {
        aside { class: "w-64 bg-gray-800 border-r border-gray-700 flex flex-col",
            div { class: "p-4 border-b border-gray-700",
                h2 { class: "text-sm font-semibold text-gray-400 uppercase", "Lanes" }
            }
            div { class: "flex-1 overflow-y-auto",
                for lane in lanes.iter() {
                    LaneItem { lane: lane.clone() }
                }
            }
            button {
                class: "m-4 p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm",
                onclick: move |_| {
                    // Create new lane
                },
                "+ New Lane"
            }
        }
    }
}
```

---

## Data Flow

```
User Input (Keyboard/Mouse)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dioxus Event Handler                      │
│  (onkeydown, onclick, oninput, etc.)                        │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Command   │     │   Direct    │     │   JS Interop    │
│   Palette   │     │   Action    │     │  (Monaco/Term)  │
└──────┬──────┘     └──────┬──────┘     └────────┬────────┘
       │                   │                      │
       └───────────────────┼──────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Action Dispatcher    │
              │   (pattern matching)    │
              └────────────┬────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Core     │    │   Plugin    │    │    LSP      │
│   Service   │    │   Runtime   │    │   Client    │
│ (Lane, Git) │    │   (WASM)    │    │  (tower)    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Signal Update  │
                 │  (state.set())  │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Component      │
                 │  Re-render      │
                 │ (reactive)      │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  WebView DOM    │
                 │   Update        │
                 └─────────────────┘
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

### Dioxus Configuration

```toml
# Dioxus.toml
[application]
name = "codelane"
default_platform = "desktop"

[desktop]
title = "Codelane"
width = 1200
height = 800
resizable = true
decorations = true

[desktop.window]
min_width = 800
min_height = 600

[web.watcher]
watch_path = ["src", "assets"]
reload_html = true
index_on_404 = true

[web.resource]
style = ["assets/tailwind.css"]
script = ["assets/monaco.js", "assets/terminal.js"]

[bundle]
identifier = "dev.codelane.app"
publisher = "Codelane"
icon = ["assets/icons/icon.png"]
```

### Development Commands

```bash
# Install Dioxus CLI
cargo install dioxus-cli

# Development with hot reload
dx serve --platform desktop

# Development with Rust hot-patching (experimental)
dx serve --platform desktop --hotpatch

# Build release
dx build --release --platform desktop

# Bundle for distribution
dx bundle --platform desktop

# Run tests
cargo test --workspace

# Lint
cargo clippy --workspace -- -D warnings
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
            target: x86_64-apple-darwin
            artifact: codelane-macos-x64
          - os: macos-latest
            target: aarch64-apple-darwin
            artifact: codelane-macos-arm64
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: codelane-windows-x64
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact: codelane-linux-x64

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install Dioxus CLI
        run: cargo install dioxus-cli

      - name: Build
        run: dx build --release --platform desktop --target ${{ matrix.target }}

      - name: Bundle
        run: dx bundle --platform desktop

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: dist/
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
If WebView performance is insufficient:
- Migrate to Dioxus Blitz (WGPU renderer)
- Custom terminal renderer with wgpu
- Requires reimplementing Monaco features

### Mobile Support
- Dioxus supports iOS/Android
- Touch-optimized UI components
- Remote lane connections
