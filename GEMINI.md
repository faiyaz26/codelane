# Gemini CLI Project Conventions

This document captures project-specific conventions and mandates for Gemini CLI.

## Mandates

1. **Release Notes**: Whenever you perform a version bump or complete a significant set of features/fixes, you MUST create or update a release notes file in the `changelogs/` directory.
   - File format: `changelogs/v<VERSION>.md` (e.g., `changelogs/v0.2.2.md`).
   - Content: Bullet points for Features, Improvements, and Bug Fixes.
   - This file is automatically read by GitHub Actions during the release process.

2. **Backend-Only Storage**: 
   - Lanes MUST be managed by the Rust backend only.
   - Do NOT add persistent storage logic for lanes in the frontend.
   - Use `frontend/src/lib/lane-api.ts` which wraps Tauri commands.

3. **External Command Execution**:
   - On Unix: Use interactive login shells (`-li`) via `Command::new(shell)` to ensure user environment (nvm, path, etc.) is loaded.
   - On Windows: Wrap commands in `cmd /C` to ensure `.cmd` and `.bat` shims resolve correctly.

4. **Terminal Scrolling**:
   - Terminal auto-scroll MUST be reactive to user behavior.
   - If a user manually scrolls up, auto-scroll MUST be paused.
   - A "Scroll to Bottom" button MUST be shown when the user is scrolled up.

## Documentation Guidelines

- **DO NOT** create implementation summaries or progress logs as separate files.
- **Use NOTES.md** for temporary work-in-progress notes and clean it up regularly.
- **Update existing files**: `README.md`, `features.md`, and this file (`GEMINI.md`).

## Technical Stack

- **Frontend**: SolidJS + TypeScript (Vite)
- **Backend**: Rust + Tauri 2.x
- **Shared**: Rust workspace crates under `crates/`
- **Package Manager**: pnpm

## UI/UX Standards

- Follow the **Zed-inspired** theme palette.
- Maintain native-feeling performance (instant UI updates).
- Use platform-agnostic paths wherever possible (backend handles resolution).
