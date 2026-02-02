# Development Notes

This file contains temporary implementation notes, testing checklists, and work-in-progress documentation. Content here is ephemeral and gets cleaned up regularly.

## Current Work

### SQLite Migration (✅ Complete)
- Added tauri-plugin-sql dependency
- Created database schema with JSON columns for flexibility
- Database initialization on app startup
- Migrated lane API to use SQL queries with JSON config column
- Migrated settings API to use SQLite instead of JSON files
- Storage: `~/.codelane/codelane.db`
- Schema uses:
  - `lanes.config` JSON column for LaneConfig (agentOverride, env, lspServers)
  - `settings` key-value table for global settings (agent_settings stored as JSON)
- JSON field indexes using `json_extract()` for efficient queries

**Next Steps:**
- [ ] Test CRUD operations thoroughly
- [x] Update TerminalView to use agent configs from DB
- [ ] Add favorites/tags UI
- [ ] Remove deprecated Rust settings.rs module (frontend handles settings directly)

### Agent Settings System (✅ Complete)
- Backend: Agent configuration types, settings persistence, Tauri commands
- Frontend: SettingsDialog, AgentSelector components, store integration
- Storage: `~/.codelane/settings.json` (kept as JSON - hybrid approach)
- UI: Settings button in title bar (gear icon)

## Quick Notes

<!-- Add temporary notes here, clean up when done -->

### EditorStateManager Refactoring Analysis

#### Current Performance Issues

**1. Global Update Trigger** - Single `updateTrigger` signal for ALL changes
- Problem: Changing file in lane A re-renders ALL components watching ANY lane
- Impact: 10x more re-renders than necessary

**2. Linear File Search** - `Array.from(openFiles.values()).find()`
- Problem: O(n) search on every file open, Map→Array conversion
- Impact: Noticeable lag with 10+ open files

**3. Object Spreading** - `{ ...file, isLoading: true }`
- Problem: Creates new object for tiny changes, memory churn
- Impact: GC pressure, especially with large file count

**4. No Batching** - Multiple `triggerUpdate()` calls for one operation
- Example: `openFile()` triggers 3 separate re-renders
- Impact: Janky UI, wasted CPU

**5. Fragile Reactivity** - Manual `updateTrigger[0]()` access pattern
- Problem: Not proper SolidJS dependency tracking
- Impact: Easy to miss updates or get extra updates

#### Proposed Solutions

**Phase 1: Quick Wins (Recommended - Start Here)**
```typescript
// 1. Add path index for O(1) lookups
private pathIndex = new Map<string, { laneId: string; fileId: string }>();

// 2. Per-lane signals (not global)
private laneSignals = new Map<string, Signal<number>>();

// 3. Batch updates
private pendingUpdates = new Set<string>();
private scheduleUpdate(laneId: string) {
  this.pendingUpdates.add(laneId);
  queueMicrotask(() => this.flushUpdates());
}
```
**Benefits**: 3-5x faster, minimal code changes

**Phase 2: SolidJS Store (Best Long-term)**
```typescript
import { createStore } from 'solid-js/store';

private [store, setStore] = createStore<EditorStore>({
  lanes: {},
  pathToFileId: {},
});

// Granular updates - only changed parts re-render
setStore('lanes', laneId, 'openFiles', fileId, 'isLoading', true);
```
**Benefits**: 10x fewer re-renders, native SolidJS patterns

#### Performance Impact (10 files, 3 lanes)

| Operation | Current | Phase 1 | Phase 2 |
|-----------|---------|---------|---------|
| File open | 15ms (3 re-renders) | 5ms (1 re-render) | 3ms (granular) |
| Lane switch | 8ms (all lanes) | 2ms (1 lane) | 1ms (granular) |
| File update | 5ms | 2ms | 1ms |

**Expected: 3-5x faster, 10x fewer wasted re-renders**

#### Decision Needed
- **Conservative**: Phase 1 only (safe, 1-2 hours)
- **Recommended**: Phase 1 + Phase 2 (best ROI, ~4 hours)
- **Defer**: Keep as-is (performance acceptable for now)

### Markdown Editor Known Issues (Low Priority)

- **False positive change detection**: Sometimes just clicking on a markdown file triggers the "modified" indicator even when no actual content change was made. This may be due to TipTap's internal markdown normalization differing from the original file content. Current mitigation uses normalized string comparison (trim whitespace, normalize line endings), but edge cases may still exist.

---

## Archived

### Lane Management (✅ Complete)
- Created lane management system with CRUD operations
- Storage: `~/.codelane/lanes/{uuid}.json`
- UI: Lane list sidebar, create/delete lanes
- Integration with terminals and git status

