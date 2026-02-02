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

### Markdown Editor Known Issues (Low Priority)

- **False positive change detection**: Sometimes just clicking on a markdown file triggers the "modified" indicator even when no actual content change was made. This may be due to TipTap's internal markdown normalization differing from the original file content. Current mitigation uses normalized string comparison (trim whitespace, normalize line endings), but edge cases may still exist.

---

## Archived

### Lane Management (✅ Complete)
- Created lane management system with CRUD operations
- Storage: `~/.codelane/lanes/{uuid}.json`
- UI: Lane list sidebar, create/delete lanes
- Integration with terminals and git status

