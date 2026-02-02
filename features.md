# Codelane Features

> AI Orchestrator for Local Development - Manage multiple AI coding agents across projects

## Core Concepts

- **Lane**: A project workspace with its own terminal, AI agents, git state, and configuration
- **Agent**: CLI-based AI coding assistants (Claude Code, Aider, OpenCode, etc.)
- **Review Flow**: Human-centric code review with AI-generated explanations (planned)

---

## Phase 1: Foundation (MVP)

### Theming System
- [x] Zed Editor-inspired default theme
- [x] Three themes: Dark, Zed One Dark, Light
- [x] Consistent spacing and typography
- [x] Semantic color tokens (background, foreground, accent, border, etc.)
- [x] ThemeManager service for SolidJS
- [x] CSS variables with RGB channels for opacity support
- [x] Theme selection UI in Settings → Appearance
- [x] Theme persistence via localStorage
- [x] Smooth transitions between UI states

### Lane Management
- [x] Create lanes with folder picker
- [x] Delete lanes
- [x] Lane persistence across sessions (SQLite database)
- [x] Lane switching via tab bar
- [x] Lane-specific working directory
- [x] Lane state serialization/restore
- [x] Lane ordering infrastructure
- [ ] Rename lanes
- [ ] Quick lane switching (keyboard shortcuts)

### Terminal Integration
- [x] Embedded xterm.js terminal emulator per lane
- [x] Support for any CLI-based AI agent
- [x] Shell environment inheritance
- [x] ANSI color and formatting support
- [x] Multiple terminal tabs per lane
- [x] Theme-aware terminal colors (updates with app theme)
- [x] Shift+Enter key binding for Claude Code compatibility
- [x] Custom PTY integration via portable-pty (low latency)
- [x] Terminal resize handling
- [ ] Terminal history persistence
- [ ] Scrollback buffer with search

### Layout System
- [x] Activity bar with view navigation
- [x] Collapsible file explorer sidebar
- [x] Collapsible bottom panel with tabs
- [x] Resizable sidebar (drag to resize)
- [x] Resizable bottom panel (drag to resize)
- [x] Layout alignment between components
- [ ] Split panes (horizontal/vertical)
- [ ] Pane zoom/maximize
- [ ] Layout presets
- [ ] Layout persistence per lane

### File Explorer
- [x] Directory tree navigation
- [x] File/folder icons
- [x] Expandable directories
- [x] File selection and viewing
- [x] Working directory display
- [x] Collapse/expand controls

### Code Viewer
- [x] Syntax highlighting with Shiki
- [x] Theme-aware highlighting (matches app theme)
- [x] Line numbers
- [x] Line hover highlighting
- [x] Lazy language loading
- [x] Multiple file support
- [x] Code folding
- [x] Search within file
- [ ] Go to line

### Settings
- [x] Settings dialog (modal)
- [x] Appearance tab with theme selection
- [x] Visual theme previews
- [x] Agent configuration per lane
- [x] Model selection (Claude models)
- [x] Agent type selection (Claude Code, Aider, Shell)
- [ ] Keybinding customization
- [ ] Font size settings

### Window Management
- [x] Custom title bar
- [x] macOS traffic light integration
- [x] Window dragging from title bar
- [x] Double-click to maximize
- [x] Lane tabs in title bar

---

## Phase 2: AI-Enhanced Review (Planned)

### Smart Diff Viewer
- [ ] Side-by-side and unified diff views
- [ ] AI-generated change explanations (per hunk/file)
- [ ] Change categorization (refactor, bugfix, feature, style)
- [ ] Risk assessment indicators
- [ ] Related changes grouping

### Code Review Interface
- [ ] Review checklist generation
- [ ] Inline commenting
- [ ] Approval/request changes workflow
- [ ] Review history tracking
- [ ] Export review as markdown

### Agent Output Processing
- [ ] Parse agent responses for code changes
- [ ] Highlight agent suggestions vs actual changes
- [ ] Track agent conversation context
- [ ] Agent command history

---

## Phase 3: Editor Features (Planned)

### Code Editor
- [ ] Full editing capabilities
- [ ] Code folding
- [ ] Minimap
- [ ] Bracket matching
- [ ] Search and replace (regex support)
- [ ] Go to line/symbol
- [ ] Multiple cursors

### Basic Git Integration
- [ ] Git status display
- [ ] Staged/unstaged file list
- [ ] Diff viewer with syntax highlighting
- [ ] Basic commit interface

### LSP Support (Opt-in)
- [ ] Language server spawning and management
- [ ] Diagnostics display (errors, warnings)
- [ ] Hover information
- [ ] Go to definition/references
- [ ] Code completion
- [ ] Auto-format on save

---

## Phase 4: Plugin Ecosystem (Future)

### Plugin Architecture
- [ ] WASM-based plugin runtime (sandboxed)
- [ ] Plugin manifest format
- [ ] Plugin marketplace/registry
- [ ] Plugin settings UI
- [ ] Hot reload for development

### Plugin Capabilities
- [ ] Custom themes
- [ ] Language support (syntax, LSP config)
- [ ] Git providers (GitHub, GitLab, Bitbucket)
- [ ] AI agent integrations
- [ ] Custom review rules
- [ ] Slash commands

---

## Technical Stack

### Frontend
- **Framework**: SolidJS (fine-grained reactivity)
- **Styling**: Tailwind CSS with CSS variables
- **Terminal**: xterm.js with fit addon
- **Syntax Highlighting**: Shiki
- **Build Tool**: Vite

### Backend
- **Runtime**: Tauri 2.0 (Rust)
- **PTY**: portable-pty (event-driven, low latency)
- **Database**: SQLite (via rusqlite)
- **IPC**: Tauri commands and events

### Platform Support
- [x] macOS (Apple Silicon + Intel)
- [ ] Windows (10+)
- [ ] Linux (X11 + Wayland)

---

## Keyboard Shortcuts (Current)

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Settings | Click gear icon | Click gear icon |
| Shift+Enter (terminal) | `Shift+Enter` | `Shift+Enter` |
| Toggle Sidebar | Click activity bar icon | Click activity bar icon |

---

## Configuration

### Lane Agent Settings (via UI)
- Agent type selection (Claude Code, Aider, Shell)
- Model selection for Claude agents
- Custom environment variables
- Working directory configuration

### Theme Persistence
- Stored in localStorage (`codelane-theme`)
- Applied on app load
- Instant switching without reload
