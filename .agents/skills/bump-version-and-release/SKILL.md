---
name: bump-version-and-release
description: Guide for bumping the Codelane app version, creating changelog entries, and committing changes. Use this when you need to increment the application version before a release.
---

# Bumping Version and Release

This skill provides instructions for updating the Codelane app version across all required files and preparing for a GitHub release.

## Version Files to Update

The Codelane app version is defined in **three files** and must be kept in sync:

1. **Cargo.toml** - Workspace version (line ~12)
   ```toml
   [workspace.package]
   version = "0.2.6"
   ```
   This is the primary source of truth.

2. **package.json** - Node/frontend version (line ~3)
   ```json
   "version": "0.2.6",
   ```

3. **src-tauri/tauri.conf.json** - Tauri app version (line ~3)
   ```json
   "version": "0.2.6",
   ```

## Step-by-Step Process

### 1. Determine the Version Type

Decide whether this is a patch, minor, or major version bump:
- **Patch** (0.2.6 → 0.2.7): Bug fixes, minor improvements
- **Minor** (0.2.6 → 0.3.0): New features, backward compatible
- **Major** (0.2.6 → 1.0.0): Breaking changes

### 2. Update All Version Files

Update all three version files with the new semantic version. Use exact string matching to avoid unintended replacements.

Example to update from 0.2.6 to 0.2.7:
```bash
sed -i '' 's/version = "0.2.6"/version = "0.2.7"/g' Cargo.toml
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' package.json
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' src-tauri/tauri.conf.json
```

### 3. Create/Update Changelog

Create a changelog entry at `changelogs/vX.Y.Z.md` with the following format:

```markdown
### Features
- New feature description

### Improvements
- Improvement description

### Bug Fixes
- Bug fix description
```

The changelog must use the exact naming convention: `changelogs/vX.Y.Z.md` (e.g., `changelogs/v0.2.7.md`)

### 4. Verify All Files Match

Before committing, verify that all three version files have the same version:

```bash
grep 'version = "0.2.7"' Cargo.toml
grep '"version": "0.2.7"' package.json
grep '"version": "0.2.7"' src-tauri/tauri.conf.json
test -f changelogs/v0.2.7.md && echo "✓ Changelog exists"
```

### 5. Commit Changes

Commit all changes with the conventional commit format:

```bash
git add Cargo.toml package.json src-tauri/tauri.conf.json changelogs/v0.2.7.md
git commit -m "chore(release): bump version to 0.2.7

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### 6. Create Git Tag

Create an annotated git tag in the format `vX.Y.Z`:

```bash
git tag -a v0.2.7 -m "Release version 0.2.7"
```

### 7. Push Changes and Tag

Push both commits and tags to the main branch:

```bash
git push origin main
git push origin v0.2.7
```

## Important Constraints

- ❌ Do NOT commit incomplete version bumps (all three files must match)
- ❌ Do NOT create a tag without a corresponding commit
- ❌ Do NOT push without all version files being in sync
- ✅ Always verify all three version files are identical before committing
- ✅ Always create a changelog entry before releasing

## Verification After Completion

```bash
# Check all version files match
grep 'version = "0.2.7"' Cargo.toml
grep '"version": "0.2.7"' package.json
grep '"version": "0.2.7"' src-tauri/tauri.conf.json

# Check changelog exists
test -f changelogs/v0.2.7.md && echo "✓ Changelog exists"

# Check git state
git log --oneline -1  # Should show version bump commit
git tag -l v0.2.7    # Should show the tag
```

## Next Step

After completing this skill, follow the `/github-release-workflow` skill to trigger the automated GitHub release.
