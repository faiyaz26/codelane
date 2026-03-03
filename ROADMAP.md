# Codelane Roadmap 🚀

> This roadmap outlines the strategic vision for Codelane. Our goal is to build the fastest, most capable desktop orchestrator for AI-driven development. Features are prioritized based on extending capabilities securely, enabling remote workflows, and maintaining our "zero-bloat" native performance.

---

## 🧩 Phase 1: Plugin Ecosystem
*Focus: Extensibility through a secure, WASM-first architecture, allowing the community to build without compromising the core app's speed or security.*

- **WASM Sandboxed Plugins:** A highly secure extension runtime. Plugins can add new UI components, themes, or AI providers, but operate in a strict sandbox without arbitrary filesystem access.
- **Custom AI Prompt Presets:** A sharable library of framework-specific system prompts (e.g., "Next.js 14 App Router rules") that agents will automatically respect within a lane.
- **Extension Registry / Marketplace:** In-app discovery of community plugins, distributed via compressed archives (e.g., `.clpack`) or GitHub releases.
- **Custom Agent Integrations:** API hooks allowing developers to easily add support for emerging CLI-based AI coding agents alongside the default Claude Code, Aider, and OpenCode integrations.

## 🌐 Phase 2: Remote & Cloud Workflows
*Focus: Moving beyond the local machine to enable seamless remote environments and mobile companions.*

- **P2P WebRTC Remote Sync (Mobile Companion):** Securely view your active lanes, monitor terminal outputs, and preview local dev servers (via proxying `localhost` ports) directly from your phone.
- **SSH / Remote Docker Lanes:** Create and manage lanes that don't execute locally. Orchestrate AI agents and terminals seamlessly inside a remote EC2 instance, WSL2, or a Docker container.
- **Remote Environment Sync:** Instantly sync dotfiles, agent configurations, and theme settings across multiple Codelane desktop installations.

## 🤖 Phase 3: AI & Workflow Enhancements
*Focus: Supercharging the daily workflow and making AI interactions more fluid.*

- **Multi-Agent Collaboration:** Allow chaining agents together within a single lane (e.g., Aider drafts the feature, Claude Code reviews and refactors, OpenCode generates tests).
- **AI-Powered Git Conflict Resolution:** Replace manual conflict resolution with a "Resolve with AI" button. Your configured agent analyzes the git history and proposes a smart merge.
- **Agent "Watch Mode":** Configure agents to run in the background, continuously monitoring file saves to auto-generate test templates, update documentation, or warn about linter issues.
- **Global Command Palette (`Cmd/Ctrl + K`):** Lightning-fast fuzzy search to switch lanes, execute custom terminal scripts, or fire off quick AI prompts without navigating the UI.

## ⚡ Phase 4: The Native "Zero-Bloat" Editor
*Focus: Bringing full IDE capabilities into Codelane without sacrificing Tauri's blazing-fast performance.*

- **Native LSP Integration:** Opt-in Language Server Protocol support powered by Rust, providing low-latency code completion, go-to-definition, and inline diagnostics.
- **Semantic Code Minimap:** A fast, GPU-accelerated minimap that not only shows code structure but highlights regions currently being modified by AI agents in real-time.
- **Regex-Powered Global Search & Replace:** Multi-file search and replace across the workspace with AI-assisted regex generation.

---

*Note: This roadmap is a living document. Priorities may shift based on community feedback and advancements in AI tooling.*