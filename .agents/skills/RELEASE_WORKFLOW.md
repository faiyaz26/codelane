# GitHub Release Workflow Instructions

This document explains how the Codelane release workflow works and how to trigger it.

## Release Workflow Overview

The release process is automated via GitHub Actions (`.github/workflows/release.yml`):

1. **Manual Trigger** - A maintainer manually starts the workflow on GitHub
2. **Build & Test** - Runs tests on multiple platforms (macOS, Linux, Windows)
3. **Build Artifacts** - Compiles the app for all target platforms
4. **Create Release** - GitHub release is created with:
   - Release notes from `changelogs/vX.Y.Z.md`
   - Platform-specific binaries
   - Auto-updater signatures

## Triggering a Release

### Prerequisites

Before triggering a release, ensure:

1. **Version is bumped** across all three files:
   - `Cargo.toml` 
   - `package.json`
   - `src-tauri/tauri.conf.json`
   
2. **Changelog exists** at `changelogs/vX.Y.Z.md`
   - The workflow reads this file for release notes
   - If file is missing, it uses a default message

3. **All changes are committed and pushed** to `main` branch

4. **Git tag exists** in the format `vX.Y.Z`
   - The workflow can auto-detect the version from `src-tauri/tauri.conf.json`
   - Or use a custom tag name via workflow input

### Manual Trigger via GitHub UI

1. Go to: https://github.com/codelane/codelane/actions
2. Select "Release App" workflow
3. Click "Run workflow"
4. Choose branch: `main`
5. Optionally enter custom tag name (leave empty to auto-detect from tauri.conf.json)
6. Click "Run workflow"

### Workflow Execution Steps

The `Release App` workflow:

1. **Checks out** the latest code from main
2. **Sets up** Node.js 20, Rust, and Tauri CLI
3. **Installs** pnpm dependencies
4. **Runs tests**:
   - Frontend: `cd frontend && pnpm test`
   - Backend: `cd src-tauri && cargo test`
5. **Builds frontend**: `cd frontend && pnpm build`
6. **Determines tag** from:
   - Workflow input (if provided), OR
   - `src-tauri/tauri.conf.json` version field
7. **Reads release notes** from:
   - `changelogs/{TAG}.md` (e.g., `changelogs/v0.2.7.md`), OR
   - Default message if file not found
8. **Builds and releases** app using Tauri action:
   - Compiles for: macOS (arm64+x86_64), Ubuntu, Windows
   - Creates GitHub release
   - Attaches platform-specific binaries
   - Generates auto-updater signatures

## Release Notes Format

The workflow reads `changelogs/vX.Y.Z.md` and uses its content as the GitHub release body.

Example format:

```markdown
### Features
- New AI agent system for parallel development
- Enhanced terminal with scrolling support

### Improvements
- Faster app startup time
- Better error messages

### Bug Fixes
- Fixed terminal process leak
- Resolved race conditions in lane switching
```

## Important Constraints

- ❌ Do NOT release without pushing changes and tags to remote
- ❌ Do NOT release without a changelog entry
- ❌ Do NOT trigger release if tests fail locally
- ✅ Always verify version files are in sync before triggering
- ✅ Always push all commits and tags before triggering workflow
- ✅ The workflow auto-detects version from tauri.conf.json

## Platform-Specific Details

### macOS
- Builds both aarch64 (ARM) and x86_64 (Intel)
- Requires Apple signing credentials (configured in GitHub secrets)
- Universal binary auto-updater support

### Linux (Ubuntu 22.04)
- Uses GTK3 + WebKit2
- Produces AppImage for distribution

### Windows
- MSVC toolchain
- Produces MSI installer

## Troubleshooting

### Release Workflow Failed
1. Check the GitHub Actions log for errors
2. Verify all tests pass locally first
3. Confirm all version files are in sync
4. Ensure changelog file exists and is readable

### Missing Release Notes
- Check that `changelogs/vX.Y.Z.md` exists in the format `{TAG}.md`
- Example: if tag is `v0.2.7`, file should be `changelogs/v0.2.7.md`

### Binaries Not Attached
- Check GitHub Actions log for compilation errors
- Verify all platform tests passed
- Confirm TAURI_SIGNING_PRIVATE_KEY secret is configured

## Environment Variables & Secrets

The workflow uses these GitHub secrets for signing and deployment:

- `TAURI_PRIVATE_KEY` - App signing key (for auto-updater)
- `TAURI_KEY_PASSWORD` - Password for signing key
- `APPLE_CERTIFICATE` - macOS signing certificate
- `APPLE_CERTIFICATE_PASSWORD` - macOS certificate password
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` - Apple developer credentials
- `GITHUB_TOKEN` - Automatically provided by GitHub (for releases)

## Example Release Checklist

```bash
# 1. Bump version in all three files
sed -i '' 's/version = "0.2.6"/version = "0.2.7"/g' Cargo.toml
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' package.json
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' src-tauri/tauri.conf.json

# 2. Create changelog at changelogs/v0.2.7.md

# 3. Commit all changes
git add .
git commit -m "chore(release): bump version to 0.2.7

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# 4. Create and push tag
git tag -a v0.2.7 -m "Release version 0.2.7"
git push origin main
git push origin v0.2.7

# 5. Verify tag exists
git tag -l v0.2.7

# 6. Go to GitHub Actions and manually trigger "Release App" workflow
# (or workflow auto-detects from tauri.conf.json)
```

## Resources

- GitHub Actions workflow: `.github/workflows/release.yml`
- Tauri Release Action: https://github.com/tauri-apps/tauri-action
- Version files: `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`
- Changelog directory: `changelogs/`
