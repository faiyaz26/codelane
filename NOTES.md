# Development Notes

This file contains temporary implementation notes, testing checklists, and work-in-progress documentation. Content here is ephemeral and gets cleaned up regularly.

## Current Work

### SQLite Migration (✅ Complete)
- Added tauri-plugin-sql dependency
- Created comprehensive database schema
- Database initialization on app startup
- Migrated lane API to use SQL queries
- Storage: `~/.codelane/codelane.db`

**Next Steps:**
- [ ] Add migration tool for existing JSON lane files
- [ ] Test CRUD operations thoroughly
- [ ] Update TerminalView to use agent configs from DB
- [ ] Add favorites/tags UI

### Agent Settings System (✅ Complete)
- Backend: Agent configuration types, settings persistence, Tauri commands
- Frontend: SettingsDialog, AgentSelector components, store integration
- Storage: `~/.codelane/settings.json` (kept as JSON - hybrid approach)
- UI: Settings button in title bar (gear icon)

## Quick Notes

<!-- Add temporary notes here, clean up when done -->

---

## Archived

### Lane Management (✅ Complete)
- Created lane management system with CRUD operations
- Storage: `~/.codelane/lanes/{uuid}.json`
- UI: Lane list sidebar, create/delete lanes
- Integration with terminals and git status

