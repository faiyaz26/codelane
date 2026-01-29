# Development Notes

This file contains temporary implementation notes, testing checklists, and work-in-progress documentation. Content here is ephemeral and gets cleaned up regularly.

## Current Work

### Agent Settings System (✅ Complete)
- Backend: Agent configuration types, settings persistence, Tauri commands
- Frontend: SettingsDialog, AgentSelector components, store integration
- Storage: `~/.codelane/settings.json`
- UI: Settings button in title bar (gear icon)

**Next Steps:**
- [ ] Test the settings UI in dev mode
- [ ] Update TerminalView to use agent configs
- [ ] Add per-lane agent override UI

## Quick Notes

<!-- Add temporary notes here, clean up when done -->

---

## Archived

### Lane Management (✅ Complete)
- Created lane management system with CRUD operations
- Storage: `~/.codelane/lanes/{uuid}.json`
- UI: Lane list sidebar, create/delete lanes
- Integration with terminals and git status

