---
name: github-release-workflow
description: Guide for triggering the Codelane GitHub Actions release workflow. Use this after bumping the version to create and publish a release.
---

# GitHub Release Workflow

This skill provides instructions for triggering the automated GitHub Actions release workflow for Codelane.

## Prerequisites

Before triggering a release, ensure:

1. **Version is bumped** across all three files:
   - `Cargo.toml` 
   - `package.json`
   - `src-tauri/tauri.conf.json`
   
   All three files must have the same version number.

2. **Changelog exists** at `changelogs/vX.Y.Z.md`
   - Example: `changelogs/v0.2.7.md`
   - The workflow reads this file for release notes
   - If file is missing, it uses a default message

3. **All changes are committed and pushed** to `main` branch

4. **Git tag exists** in the format `vX.Y.Z`
   - Example: `v0.2.7`
   - The workflow can auto-detect the version from `src-tauri/tauri.conf.json`

## Release Workflow Overview

The `Release App` workflow at `.github/workflows/release.yml`:

1. Checks out the latest code from main
2. Sets up Node.js 20, Rust, and Tauri CLI
3. Installs pnpm dependencies
4. Runs tests:
   - Frontend: `cd frontend && pnpm test`
   - Backend: `cd src-tauri && cargo test`
5. Builds frontend: `cd frontend && pnpm build`
6. Determines tag from workflow input or `src-tauri/tauri.conf.json` version
7. Reads release notes from `changelogs/{TAG}.md`
8. Builds and releases app for all platforms (macOS, Linux, Windows)

## Triggering a Release

### Option 1: Automatic Detection (Recommended)

The workflow will automatically detect the version from `src-tauri/tauri.conf.json`:

1. Go to: https://github.com/codelane/codelane/actions
2. Find the "Release App" workflow
3. Click "Run workflow"
4. Leave "tag_name" empty (it will auto-detect)
5. Click "Run workflow"

### Option 2: Manual Tag Name

If you need to specify a custom tag name:

1. Go to: https://github.com/codelane/codelane/actions
2. Find the "Release App" workflow
3. Click "Run workflow"
4. Enter the tag name in "tag_name" field (e.g., `v0.2.7`)
5. Click "Run workflow"

## What Happens During the Workflow

### Multi-Platform Builds

The workflow compiles for these platforms:
- **macOS (ARM)**: `aarch64-apple-darwin`
- **macOS (Intel)**: `x86_64-apple-darwin`
- **Linux**: Ubuntu 22.04
- **Windows**: x86_64-pc-windows-msvc

### Release Notes

The workflow reads the changelog from `changelogs/{TAG}.md` and uses it as the GitHub release body.

Example changelog format:

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

### Artifacts Generated

The release will include:
- Platform-specific binaries (DMG for macOS, AppImage for Linux, MSI for Windows)
- Auto-updater signatures for all platforms
- Release notes from changelog

## Monitoring the Workflow

1. Go to https://github.com/codelane/codelane/actions
2. Click on the running "Release App" workflow
3. Watch the progress of builds across all platforms
4. If a build fails, check the logs for details

## Troubleshooting

### Workflow Failed
- Check the GitHub Actions log for errors
- Verify all tests pass locally first
- Confirm all version files are in sync
- Ensure changelog file exists and is readable

### Missing Release Notes
- Check that `changelogs/vX.Y.Z.md` exists
- File name must match the tag exactly (e.g., tag `v0.2.7` requires `changelogs/v0.2.7.md`)

### Binaries Not Attached
- Check GitHub Actions log for compilation errors
- Verify all platform tests passed
- Confirm signing keys are configured (see Environment section below)

## Required GitHub Secrets

The workflow uses these GitHub secrets for signing and deployment:

- `TAURI_PRIVATE_KEY` - App signing key (for auto-updater)
- `TAURI_KEY_PASSWORD` - Password for signing key
- `APPLE_CERTIFICATE` - macOS signing certificate
- `APPLE_CERTIFICATE_PASSWORD` - macOS certificate password
- `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` - Apple developer credentials
- `GITHUB_TOKEN` - Automatically provided by GitHub (for releases)

If any of these secrets are missing or incorrect, the build will fail for that platform.

## Complete Release Checklist

```bash
# 1. Verify current version
grep 'version = "' Cargo.toml | head -1

# 2. Update version in all three files (example: 0.2.6 → 0.2.7)
sed -i '' 's/version = "0.2.6"/version = "0.2.7"/g' Cargo.toml
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' package.json
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' src-tauri/tauri.conf.json

# 3. Create changelog at changelogs/v0.2.7.md

# 4. Verify all versions match
grep 'version = "0.2.7"' Cargo.toml
grep '"version": "0.2.7"' package.json
grep '"version": "0.2.7"' src-tauri/tauri.conf.json

# 5. Commit changes
git add .
git commit -m "chore(release): bump version to 0.2.7

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# 6. Create and push tag
git tag -a v0.2.7 -m "Release version 0.2.7"
git push origin main
git push origin v0.2.7

# 7. Verify tag exists
git tag -l v0.2.7

# 8. Go to GitHub Actions and manually trigger "Release App" workflow
```

## Resources

- GitHub Actions workflow: `.github/workflows/release.yml`
- Tauri Release Action: https://github.com/tauri-apps/tauri-action
- Version files: `Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json`
- Changelog directory: `changelogs/`
