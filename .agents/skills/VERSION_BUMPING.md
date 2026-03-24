# Version Bumping Instructions

This document provides instructions for coding agents (Claude, Copilot) on how to bump the application version.

## Version Locations

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

## Version Bumping Process

When bumping the version (e.g., from 0.2.6 to 0.2.7):

1. **Update all three files** with the new semantic version (MAJOR.MINOR.PATCH)
   - Do not update individual dependency versions, only the app version
   - Use exact string matching to avoid unintended replacements

2. **Update Cargo.lock** (if it exists and is tracked)
   - Run `cargo update --workspace` to regenerate it
   - Or commit it as-is if it auto-updates

3. **Create/update changelog** at `changelogs/vX.Y.Z.md`
   - Format: Markdown with ### Features, ### Improvements, ### Bug Fixes sections
   - Example: `changelogs/v0.2.7.md`
   - This is required for GitHub releases

4. **Commit changes**
   - Include all three version files and the changelog
   - Use conventional commit format: `chore(release): bump version to X.Y.Z`
   - Include the Copilot trailer: `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`

5. **Create git tag**
   - Format: `vX.Y.Z` (e.g., `v0.2.7`)
   - Annotated tag with message: `Release version X.Y.Z`

6. **Push to main**
   - Push both commits and tags to origin/main
   - Command: `git push origin main && git push origin vX.Y.Z`

## Semantic Versioning

- **Patch** (0.2.6 → 0.2.7): Bug fixes, minor improvements
- **Minor** (0.2.6 → 0.3.0): New features, backward compatible
- **Major** (0.2.6 → 1.0.0): Breaking changes

## Important Constraints

- ❌ Do NOT commit incomplete version bumps (all three files must match)
- ❌ Do NOT create a tag without a corresponding commit
- ❌ Do NOT push without all version files being in sync
- ✅ Always verify all three version files are identical before committing
- ✅ Always create a changelog entry before releasing

## Verification Steps

After bumping, verify:

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

## Example Commands

```bash
# View current version
grep 'version = "' Cargo.toml | head -1

# Update all version files (example: 0.2.6 → 0.2.7)
sed -i '' 's/version = "0.2.6"/version = "0.2.7"/g' Cargo.toml
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' package.json
sed -i '' 's/"version": "0.2.6"/"version": "0.2.7"/g' src-tauri/tauri.conf.json

# Commit with trailer
git commit -am "chore(release): bump version to 0.2.7

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# Create tag and push
git tag -a v0.2.7 -m "Release version 0.2.7"
git push origin main v0.2.7
```
