# Codelane Skills

Instruction sets for coding agents (Claude, Copilot) on common development tasks.

## What Are Skills?

Skills are detailed instruction documents that guide AI agents on:
- Where key files are located
- How to make changes safely
- What validations to perform
- How to integrate with CI/CD workflows

Skills enable agents to perform complex, multi-step tasks with minimal supervision.

## Available Skills

### 1. Version Bumping
**File:** `VERSION_BUMPING.md`

Instructions for bumping the app version across:
- `Cargo.toml` (Rust workspace)
- `package.json` (Node/frontend)
- `src-tauri/tauri.conf.json` (Tauri app config)

Includes:
- Semantic versioning guidelines
- File sync requirements
- Verification steps
- Example commands

### 2. Release Workflow
**File:** `RELEASE_WORKFLOW.md`

Instructions for triggering automated GitHub releases via Actions.

Includes:
- Workflow overview and prerequisites
- How to manually trigger the workflow
- Changelog format requirements
- Platform-specific build details
- Troubleshooting guide
- Complete release checklist

## How Agents Should Use These Skills

When an agent needs to perform a complex task:

1. **Locate the skill** - Find the relevant `.md` file in this directory
2. **Read instructions** - Follow the step-by-step guidance
3. **Verify prerequisites** - Ensure all constraints and requirements are met
4. **Perform task** - Execute changes following the specified process
5. **Validate** - Run verification steps to confirm correctness

## Example: Complete Release Workflow

An agent performing a "bump version and release" task would:

1. Read `VERSION_BUMPING.md` to understand where versions are defined
2. Update all three version files in sync
3. Create a changelog entry
4. Commit with the proper message format
5. Create and push the git tag
6. Read `RELEASE_WORKFLOW.md` to understand the GitHub workflow
7. Verify all prerequisites are met
8. (Optional) Manually trigger the workflow on GitHub, or wait for it to auto-detect

## Creating New Skills

To add a new skill to the system:

1. Create a new `.md` file in this directory
2. Name it descriptively: `SKILL_NAME.md`
3. Include:
   - Overview of what the skill does
   - Prerequisites and constraints
   - Step-by-step instructions
   - File locations and formats
   - Verification/validation steps
   - Example commands or workflows
   - Troubleshooting tips

## Design Principles

- **Agent-friendly** - Written for AI agents, not humans
- **Prescriptive** - Specific instructions, not vague guidelines
- **Safe** - Clear validation steps to prevent mistakes
- **Complete** - Include all relevant information in one place
- **Verifiable** - Include commands to verify each step

## Future Skills

Potential future skills:

- `ADDING_FEATURES.md` - How to add features safely
- `BUG_FIXING.md` - Process for finding and fixing bugs
- `TESTING.md` - How to add and run tests
- `DOCUMENTATION.md` - Updating docs and changelogs
- `DEPENDENCY_UPDATES.md` - Safely updating dependencies
