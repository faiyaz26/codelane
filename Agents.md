# Agent Instructions for Codelane

This document contains instructions for AI agents working on this project.

## Commit Guidelines

- **DO NOT** add "Co-Authored-By: Claude" or similar attribution in commit messages
- Write clear, concise commit messages following conventional commits format
- Focus on the "why" not the "what" in commit messages

## Documentation Guidelines

**DO NOT create these types of files:**
- Implementation summaries (e.g., `IMPLEMENTATION_*.md`, `*_IMPLEMENTATION.md`)
- Detailed status reports or progress documentation
- Step-by-step completion logs or checklists as markdown files
- Testing guides as separate files

**Use NOTES.md for temporary content:**
- Implementation notes while working on a feature
- Quick testing checklists
- Work-in-progress documentation
- Clean up regularly when work is complete

**Keep documentation minimal and in existing files:**
- The codebase itself is the source of truth
- Update existing docs (README.md, CLAUDE.md, features.md, tech-architecture.md) when needed
- Use inline code comments for complex logic
- Use commit messages for change history

## Project Context

**Codelane** is an AI orchestrator for local development. It's a desktop application built with:
- **Frontend**: SolidJS + TypeScript + Vite
- **Backend**: Rust + Tauri 2.x
- **Styling**: Tailwind CSS

## Architecture Principles

1. **Security First**
   - Follow Tauri security best practices
   - Minimize permissions (principle of least privilege)
   - Strict CSP configuration
   - No external CDN dependencies

2. **Performance**
   - Optimize for desktop (not web)
   - Target modern browsers (ES2021+)
   - Fast HMR and build times
   - Efficient memory usage

3. **Developer Experience**
   - Simple setup (just `pnpm install`)
   - Clear error messages
   - Fast iteration cycle
   - Good TypeScript types

## Development Workflow

1. Use **pnpm** for all package management
2. Use **Makefile** for common commands
3. Follow workspace structure (frontend/ for UI, src-tauri/ for backend)
4. Keep frontend and backend concerns separated

## Code Style

### TypeScript/SolidJS
- Use functional components
- Prefer signals over stores for local state
- Use TypeScript strict mode
- Follow SolidJS conventions

### Rust
- Use workspace for shared crates
- Follow Rust idioms and conventions
- Prefer type safety over convenience
- Use thiserror for errors

## Testing

- Test Tauri commands independently
- Test UI components in isolation
- Integration tests for critical flows

## Best Practices to Maintain

See `TAURI_BEST_PRACTICES.md` for detailed Tauri-specific guidelines.
See `CLAUDE.md` for project conventions and patterns.
