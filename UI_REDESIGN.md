# UI Redesign Tracking

## Goal
Redesign the UI to match the reference design with lanes as tabs, activity bar, file explorer, and improved layout.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo]  [Lane Tabs: Lane 1 | Lane 2 | ...]                    [+][⚙][👤]  │  ← Top Bar
├──┬──────────────────┬───────────────────────────┬───────────────────────────┤
│  │                  │                           │                           │
│A │   File Explorer  │   Code Editor (stub)      │   Agent Terminal          │
│c │                  │                           │                           │
│t │   - Files tab    │   (placeholder for now)   │   (existing component)    │
│i │   - Changes tab  │                           │                           │
│v │                  │                           │                           │
│i │   File tree      │                           │                           │
│t │                  ├───────────────────────────┤                           │
│y │                  │   Bottom Panel            │                           │
│  │                  │   (existing terminal)     │                           │
│B │                  │                           │                           │
│a │                  │                           │                           │
│r │                  │                           │                           │
├──┴──────────────────┴───────────────────────────┴───────────────────────────┤
│  [branch] [git status]                              [info] [Ln/Col]         │  ← Status Bar
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components Status

### Phase 1: Core Layout (Current)

| Component | Status | Notes |
|-----------|--------|-------|
| Top Bar | ✅ DONE | Lane tabs, +new lane, settings, user avatar |
| Activity Bar | ✅ DONE | Slim left bar with icons (Explorer, Search, Git, etc.) |
| File Explorer | ✅ DONE | File tree with Files/Changes tabs |
| Status Bar | ✅ DONE | UI only, backend later |
| Main Layout | ✅ DONE | 3-column layout with resizable panels |

### Phase 2: Integration

| Component | Status | Notes |
|-----------|--------|-------|
| Agent Terminal | ✅ DONE | Moved to right panel |
| Bottom Panel | ✅ DONE | Integrated into new layout |

### Skipped (Future)

| Component | Status | Notes |
|-----------|--------|-------|
| Timeline | ⏭️ SKIP | Git commit history - not needed now |
| File Tabs | ⏭️ SKIP | Open file tabs above editor - future |
| Code Editor | ⏭️ SKIP | Monaco integration - future |

## Implementation Order

1. [x] Create tracking file
2. [x] Create new layout structure (MainLayout.tsx)
3. [x] Implement TopBar component
4. [x] Implement ActivityBar component
5. [x] Implement FileExplorer component
6. [x] Implement StatusBar component
7. [x] Integrate existing TerminalView (right panel)
8. [x] Integrate existing BottomPanel
9. [x] Wire up lane switching
10. [ ] Test and polish

## File Structure (New Components)

```
frontend/src/components/
├── layout/
│   ├── MainLayout.tsx      # Main app layout orchestrator
│   ├── TopBar.tsx          # Lane tabs, app controls
│   ├── ActivityBar.tsx     # Left slim icon bar
│   ├── StatusBar.tsx       # Bottom status bar
│   └── ResizablePanel.tsx  # Reusable resizable panel
├── explorer/
│   ├── FileExplorer.tsx    # File explorer container
│   ├── FileTree.tsx        # File tree component
│   └── FileTreeItem.tsx    # Individual tree item
├── editor/
│   └── EditorPlaceholder.tsx  # Placeholder until Monaco
└── (existing components...)
```

## Progress Log

### Session 1 - 2026-02-01
- Created tracking file
- Planning component structure
- Implemented all Phase 1 components:
  - TopBar.tsx - Lane tabs with close buttons, +new lane, settings, notifications, user avatar
  - ActivityBar.tsx - Slim icon bar with Explorer, Search, Git, Extensions icons
  - FileExplorer.tsx - File tree with Files/Changes tabs, recursive directory loading
  - StatusBar.tsx - Git branch, errors/warnings, language, encoding, line/col
  - EditorPlaceholder.tsx - Placeholder for future Monaco integration
  - MainLayout.tsx - Orchestrates all components with resizable panels
- Updated App.tsx to use new MainLayout
- TypeScript compiles cleanly
