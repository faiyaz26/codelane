# Codelane Features

> AI Orchestrator for Local Development - Manage multiple AI coding agents across projects

## Core Concepts

- **Lane**: A project workspace with its own terminal, AI agents, git state, and configuration
- **Agent**: CLI-based AI coding assistants (Claude Code, OpenCode, GitHub Copilot CLI, Aider, etc.)
- **Review Flow**: Human-centric code review with AI-generated explanations

---

## Phase 1: Foundation (MVP)

### Theming System
- [ ] Zed Editor-inspired default theme
- [ ] Dark mode with professional color palette
- [ ] Consistent spacing and typography
- [ ] Semantic color tokens (background, foreground, accent, border, etc.)
- [ ] Theme context provider for SolidJS
- [ ] CSS variables for dynamic theming
- [ ] Smooth transitions between UI states

### Lane Management
- [ ] Create, rename, delete lanes (projects)
- [ ] Lane persistence across sessions
- [ ] Quick lane switching (keyboard shortcuts)
- [ ] Lane-specific working directory and environment
- [ ] Lane state serialization/restore

### Terminal Integration
- [ ] Embedded terminal emulator per lane
- [ ] Support for any CLI-based AI agent
- [ ] Shell environment inheritance
- [ ] Terminal history persistence
- [ ] Copy/paste support
- [ ] ANSI color and formatting support
- [ ] Scrollback buffer with search

### Multi-Pane Layout
- [ ] Split panes (horizontal/vertical)
- [ ] Drag-and-drop pane resizing
- [ ] Pane zoom/maximize
- [ ] Layout presets (editor + terminal, review mode, etc.)
- [ ] Layout persistence per lane

### Basic Git Integration
- [ ] Git status display
- [ ] Staged/unstaged file list
- [ ] Diff viewer with syntax highlighting
- [ ] Basic commit interface

---

## Phase 2: AI-Enhanced Review

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

## Phase 3: Editor Features

### Code Viewer/Editor
- [ ] Syntax highlighting (tree-sitter based)
- [ ] Line numbers with clickable navigation
- [ ] Code folding
- [ ] Minimap
- [ ] Bracket matching
- [ ] Search and replace (regex support)
- [ ] Go to line/symbol

### LSP Support (Opt-in)
- [ ] Language server spawning and management
- [ ] Diagnostics display (errors, warnings)
- [ ] Hover information
- [ ] Go to definition/references
- [ ] Code completion
- [ ] Signature help
- [ ] Auto-format on save

### Markdown Preview
- [ ] Live preview pane
- [ ] GitHub Flavored Markdown support
- [ ] Mermaid diagram rendering
- [ ] Code block syntax highlighting
- [ ] Synchronized scrolling

---

## Phase 4: Plugin Ecosystem

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
- [ ] Custom pane types

### Built-in Plugins (Separate Packages)
- [ ] GitHub integration (PR creation, review)
- [ ] GitLab integration
- [ ] Jira/Linear task linking
- [ ] Slack notifications

---

## Phase 5: Productivity Features

### Task Management
- [ ] Todo list per lane
- [ ] Task creation from code comments (TODO, FIXME)
- [ ] Task linking to commits/PRs
- [ ] Priority and status tracking
- [ ] Due dates and reminders

### Session Management
- [ ] Save/restore complete workspace state
- [ ] Named sessions
- [ ] Session templates
- [ ] Auto-save on exit

### Collaboration (Future)
- [ ] Share lane state
- [ ] Collaborative review
- [ ] Team dashboards

---

## Cross-Cutting Features

### Performance
- [ ] Sub-100ms startup time
- [ ] 60+ FPS UI rendering
- [ ] Memory usage < 200MB base
- [ ] Lazy loading of heavy features
- [ ] Background indexing

### Accessibility
- [ ] Keyboard-first navigation
- [ ] Screen reader support
- [ ] High contrast themes
- [ ] Customizable font sizes
- [ ] Focus indicators

### Customization
- [ ] Themes (dark/light/custom)
- [ ] Keybinding customization
- [ ] Settings sync (optional)
- [ ] Per-lane settings override
- [ ] Custom CSS injection

### Platform Support
- [ ] macOS (Apple Silicon + Intel)
- [ ] Windows (10+)
- [ ] Linux (X11 + Wayland)

---

## Command Palette Commands

```
Lane: New Lane
Lane: Switch Lane
Lane: Delete Lane
Lane: Rename Lane

Terminal: New Terminal
Terminal: Split Horizontal
Terminal: Split Vertical
Terminal: Clear
Terminal: Kill Process

Git: Stage File
Git: Unstage File
Git: Commit
Git: Push
Git: Pull
Git: Show Diff
Git: Explain Changes

Review: Start Review
Review: Approve
Review: Request Changes
Review: Add Comment

View: Toggle Sidebar
View: Toggle Terminal
View: Zoom Pane
View: Reset Layout

Settings: Open Settings
Settings: Keyboard Shortcuts
Settings: Themes
```

---

## Keyboard Shortcuts (Defaults)

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| New Lane | `Cmd+Shift+N` | `Ctrl+Shift+N` |
| Switch Lane | `Cmd+1-9` | `Ctrl+1-9` |
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| New Terminal | `Cmd+\`` | `Ctrl+\`` |
| Split Horizontal | `Cmd+\` | `Ctrl+\` |
| Split Vertical | `Cmd+Shift+\` | `Ctrl+Shift+\` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| Quick Open | `Cmd+P` | `Ctrl+P` |
| Find in Files | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Git Status | `Cmd+Shift+G` | `Ctrl+Shift+G` |
| Start Review | `Cmd+Shift+R` | `Ctrl+Shift+R` |

---

## Configuration File Format

```toml
# ~/.config/codelane/config.toml

[general]
theme = "dark"
font_family = "JetBrains Mono"
font_size = 14
tab_size = 4

[terminal]
shell = "/bin/zsh"  # auto-detect if not set
scrollback_lines = 10000
cursor_style = "block"

[git]
auto_fetch = true
fetch_interval_minutes = 5
show_untracked = true

[ai]
default_agent = "claude"
explain_changes = true
risk_assessment = true

[review]
checklist_enabled = true
auto_categorize = true

[plugins]
enabled = ["github", "theme-catppuccin"]

[keybindings]
# Override defaults
"cmd+k cmd+s" = "settings:keyboard_shortcuts"
```

---

## Lane Configuration

```toml
# .codelane/lane.toml (per-project)

[lane]
name = "My Project"
working_directory = "."

[terminal]
shell = "/bin/bash"
env = { NODE_ENV = "development" }

[agent]
default = "claude"
args = ["--model", "opus"]

[lsp]
enabled = ["rust-analyzer", "typescript"]

[tasks]
# Task definitions
[[tasks.items]]
id = "1"
title = "Implement user auth"
status = "in_progress"
priority = "high"
```
