# Release Changelogs

This directory contains release notes for each version of Codelane.

## How it works

When the GitHub Action for releasing the app runs, it looks for a file in this directory named after the version tag (e.g., `v0.2.2.md`).

If the file exists, its content is used as the body of the GitHub Release.

## Adding release notes

When bumping the version of the app:
1. Create a new markdown file in this directory: `v<VERSION>.md` (e.g., `v0.2.3.md`).
2. Add the features, improvements, and bug fixes for that release.
3. Commit the file along with the version bump.
