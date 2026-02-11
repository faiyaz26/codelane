# Codelane Project Conventions

This document captures project-specific conventions, patterns, and decisions for future reference.

## Project Goals

Build a fast, efficient Agentic Development Environment that:
- Enables parallel feature development across multiple project "lanes"
- Provides AI agents with human-in-the-loop code review
- Integrates terminal, editor, and git interface
- Feels native and responsive
- Follows security best practices

## Documentation Guidelines

**DO NOT create these types of files:**
- Implementation summaries (e.g., `IMPLEMENTATION_*.md`, `*_IMPLEMENTATION.md`)
- Detailed status reports or progress documentation
- Step-by-step completion logs
- Testing guides or checklists as separate files

**Use NOTES.md for temporary content:**
- Implementation notes while working on a feature
- Quick testing checklists
- Work-in-progress documentation
- This file should be cleaned up regularly

**Keep documentation in existing files:**
- `README.md` - User-facing features and setup
- `CLAUDE.md` (this file) - Conventions and patterns
- `features.md` - Feature descriptions
- Inline code comments for complex logic
- Commit messages for change history

**Rationale:** The codebase itself is the source of truth. Avoid duplicate documentation that gets out of sync.

## Technology Decisions

### Why SolidJS over React/Dioxus?

**Chose SolidJS because:**
- ⚡ Fastest framework - fine-grained reactivity, no virtual DOM
- 📦 Small bundle size - ~7KB core
- 🎯 Perfect for real-time dev tools - terminal output, file watching
- 🔧 Good ecosystem - has what we need without bloat
- 📘 TypeScript-first - good DX

**Rejected Dioxus because:**
- Immature ecosystem (0.7 breaking changes)
- Configuration complexity
- Smaller community and resources

**Rejected React because:**
- Larger bundle size
- Virtual DOM overhead
- Slower than SolidJS for real-time updates

### Why Tauri over Electron?

- 🦀 Rust backend - fast, safe, small binary
- 📦 Smaller bundle - no bundled Chromium
- 🔒 Better security model - capabilities system
- ⚡ Better performance - native OS webview

### Why pnpm over npm/yarn?

- ⚡ Faster installation
- 💾 Less disk space (hard links)
- 🔒 Strict dependency resolution
- 📦 Better monorepo support

## Architecture Patterns

### Frontend (SolidJS)

- **State Management**: Use signals for local state, context for global
- **API Calls**: Tauri invoke commands, not REST/GraphQL
- **Styling**: Tailwind utility classes, custom Codelane palette
- **Components**: Functional, typed, small and focused

### Backend (Rust + Tauri)

- **Commands**: Async, return Result<T, String>
- **Events**: Use for real-time updates (terminal output, file changes)
- **Permissions**: Define in capabilities/, not plugin config
- **Error Handling**: Thiserror for custom errors, map to String for Tauri

### Project Structure

```
├── frontend/           # SolidJS app (UI only)
├── src-tauri/         # Tauri shell (system access)
└── crates/            # Shared Rust libraries
    ├── codelane-core/     # Core types
    ├── codelane-terminal/ # PTY handling
    ├── codelane-git/      # Git operations
    └── codelane-lsp/      # LSP client
```

## Naming Conventions

- **Rust crates**: `codelane-{feature}` (kebab-case)
- **TypeScript files**: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- **Tauri commands**: `{domain}_{action}` (e.g., `git_status`, `terminal_create`)
- **CSS classes**: Tailwind utilities, custom palette via `codelane-*` prefix

## Security Guidelines

1. **Never use `unsafe-eval`** in CSP (use `wasm-unsafe-eval` for WASM only)
2. **Scope all permissions** - use capabilities for fine-grained control
3. **No external CDNs** - bundle everything locally
4. **Validate all inputs** - Tauri commands should validate parameters
5. **Use asset protocol** - for secure local file access

## Performance Guidelines

1. **Target modern browsers** - ES2021+, Chrome 100+, Safari 13+
2. **Lazy load** - Split large features into separate chunks
3. **Optimize renders** - Use SolidJS memos and createResource
4. **Async Tauri commands** - Don't block the UI thread
5. **Batch updates** - Use createEffect for batched terminal updates

## Development Workflow

### Starting Development
```bash
pnpm install  # Installs root + frontend (workspaces)
make dev      # Runs pnpm tauri dev
```

### Making Changes
1. Frontend changes - HMR via Vite (instant)
2. Backend changes - Cargo rebuilds (fast incremental)
3. Tailwind changes - Watch mode rebuilds CSS

### Before Committing
```bash
make check    # Cargo check
make fmt      # Cargo fmt
make lint     # Clippy
```

## Common Patterns

### Calling Tauri Commands from SolidJS

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<GitStatusResult>('git_status', {
  path: '/path/to/repo'
});
```

### Listening to Tauri Events

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<string>('terminal-output', (event) => {
  console.log('Terminal output:', event.payload);
});
```

### Creating Tauri Commands

```rust
#[tauri::command]
pub async fn my_command(param: String) -> Result<ReturnType, String> {
    // Implementation
    Ok(result)
}
```

## Troubleshooting

### Build Issues
- Run `cargo clean` if you get weird errors
- Run `pnpm install` if dependencies seem wrong
- Check `tauri.conf.json` for correct paths

### Dev Server Issues
- Ensure port 1420 is not in use
- Check that Vite config has correct Tauri settings
- Verify CSP allows localhost connections

## Future Improvements

- [ ] Add comprehensive test suite
- [ ] Implement plugin system (WASM)
- [ ] Add LSP integration
- [ ] Add multi-pane terminal layouts
- [ ] Integrate Monaco editor properly

## References

- [Tauri Documentation](https://tauri.app/v2/)
- [SolidJS Documentation](https://www.solidjs.com/)
- [Vite Documentation](https://vitejs.dev/)
