# Code Review Tab - Implementation Plan

## Context

Currently, the "Git Manager" tab shows file changes and commit history in a sidebar, with diffs opening in the editor. The AI Summary button generates a review that opens as a temporary markdown tab. This plan adds a dedicated **Code Review** tab (new 4th activity bar tab) with a full-screen review experience: an empty state prompts the user to generate an AI review, then displays a two-pane layout with the AI summary on the left and scrollable file-by-file diffs with contextual feedback on the right. The sidebar shows the changed file list, and the bottom panel hosts an AI agent terminal with review context pre-loaded.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TopBar  ("Generate AI Review" / "Regenerate" button)                         │
├──────────┬──────────────────────────────────┬─────────────┬──────┤
│          │  Main Content                     │  Sidebar    │ Act. │
│ Project  │  (CodeReviewLayout)               │  (File List)│ Bar  │
│ Panel    │  ┌─────────────┬────────────────┐ │  - changed  │      │
│          │  │ Left Half   │ Right Half     │ │    files    │      │
│          │  │ AI Summary  │ ┌────────────┐ │ │  - click to │      │
│          │  │ (Markdown,  │ │Diffs (2/3) │ │ │    scroll   │      │
│          │  │  read-only) │ ├────────────┤ │ │             │      │
│          │  │             │ │Context 1/3 │ │ │             │      │
│          │  └─────────────┴─┴────────────┘ │ │             │      │
├──────────┴──────────────────────────────────┴─────────────┴──────┤
│ Bottom Panel: AI Agent Terminal (review context pre-loaded)       │
└──────────────────────────────────────────────────────────────────┘
```

**States:** idle (empty state + "Generate" button) → loading (spinner) → ready (two-pane) → error (retry)

## Key Design Decisions

1. **New 4th activity bar tab** — "Code Review" added alongside Explorer, Search, Git Manager. Git Manager stays as-is.
2. **Main content takeover** — CodeReviewLayout replaces the editor area. Agent terminal hidden (same as GitManager pattern).
3. **Sidebar = file list** — simplified list of changed files with status badges. Clicking a file scrolls the diff view to that file.
4. **Bottom panel = AI agent terminal** — uses existing terminal/PTY infrastructure. A new tab is created with the review context pre-loaded so the agent has full context for follow-up questions.
5. **In-memory state per lane** — review data in SolidJS signals via `CodeReviewStore`, keyed by lane ID.
6. **All per-file feedback upfront** — summary + all file feedback generated in one batch.

## Implementation Steps

### Step 1: Create CodeReviewStore service

**New file:** `frontend/src/services/CodeReviewStore.ts`

Reactive store managing per-lane review state. Follows `EditorSettingsManager` pattern (createRoot + signals).

```typescript
interface CodeReviewState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  reviewMarkdown: string | null;
  perFileFeedback: Map<string, string>;   // filepath → feedback markdown
  sortedFiles: FileChangeStats[];
  fileDiffs: Map<string, string>;         // filepath → raw diff content
  error: string | null;
  generatedAt: number | null;
  visibleFilePath: string | null;         // tracked by scroll position
}
```

Key methods:
- `generateReview(laneId, workingDir)` — orchestrates full generation
- `getState(laneId)` — returns reactive accessor
- `setVisibleFile(laneId, path)` — updates scroll-tracked file
- `reset(laneId)` — back to idle
- `getReviewContext(laneId)` — returns combined review + diffs as text for agent terminal

Generation flow:
1. Set status to `'loading'`
2. Fetch git status, get diffs via `invoke('git_diff')` for each changed file
3. Smart-sort files via `invoke('git_sort_files')`
4. Call `aiReviewService.generateReview()` for overall summary
5. Call `aiReviewService.getCodeSuggestions()` per file (parallel, concurrency limit 3)
6. Set status to `'ready'`

Reuses: `AIReviewService`, `git-api.ts`, Tauri invoke commands.

### Step 2: Enhance AIReviewService

**Modify:** `frontend/src/services/AIReviewService.ts`

- Make `getDefaultPrompt()` public
- Add `getEnhancedReviewPrompt()` — richer structured prompt (Summary, Key Changes, Concerns, Suggestions, Positive Notes, file-by-file sections)
- Add `generateFileReview(tool, filePath, diffContent, workingDir, model?)` — focused per-file feedback
- Accept `customPrompt` from settings

### Step 3: Create CodeReviewSettingsManager

**New file:** `frontend/src/services/CodeReviewSettingsManager.ts`

Follows `EditorSettingsManager` pattern (localStorage + reactive signals in createRoot).

```typescript
interface CodeReviewSettings {
  aiTool: AITool;
  aiModel: Record<AITool, string>;
  reviewPrompt: string | null;     // null = use default
  filePrompt: string | null;       // null = use default
}
```

Storage key: `codelane-code-review-settings`. Migrates existing `codelane:aiTool` and `codelane:aiModel:*` localStorage keys.

### Step 4: Add Code Review to ActivityBar

**Modify:** `frontend/src/components/layout/ActivityBar.tsx`

- Add `ActivityView.CodeReview` to enum
- Add to `ACTIVITY_ITEMS`: `{ id: ActivityView.CodeReview, icon: 'code-review', label: 'Code Review' }`
- Add `ActivityIcon` SVG case for `'code-review'`

### Step 5: Create FileContextPanel component

**New file:** `frontend/src/components/review/FileContextPanel.tsx`

Bottom 1/3 of right half. Shows per-file AI feedback for the currently scrolled-to file.

- Header: file name + status badge
- Content: markdown-rendered feedback
- Empty state: "No feedback for this file"
- Resizable via mouse drag (reuses `CodeReviewChanges.tsx` pattern), max 1/3 height

### Step 6: Create ReviewFileScrollView component

**New file:** `frontend/src/components/review/ReviewFileScrollView.tsx`

Top 2/3 of right half. Scrollable container rendering all changed files.

Per file section:
- Sticky header: path, status badge (A/M/D/R), +/- counts
- Inline `DiffViewer` component

**Scroll tracking:** `IntersectionObserver` on file headers → calls `onVisibleFileChange(path)` to update context panel.

**Lazy rendering:** Only mount `DiffViewer` for files near viewport. Skeleton placeholder for distant files.

**External scroll-to:** Exposes a `scrollToFile(path)` method (via ref/callback) so sidebar file clicks can scroll to specific files.

### Step 7: Create ReviewChangesPanel component

**New file:** `frontend/src/components/review/ReviewChangesPanel.tsx`

Right half orchestrator. Vertical split: `ReviewFileScrollView` (top, 66%) + `FileContextPanel` (bottom, 33%).

- Manages split position signal
- Horizontal resize handle between panels
- Passes `visibleFilePath` and feedback to `FileContextPanel`

### Step 8: Create ReviewSummaryPanel component

**New file:** `frontend/src/components/review/ReviewSummaryPanel.tsx`

Left half. Read-only AI markdown summary.

- Header: "AI Review Summary", timestamp, "Regenerate" button
- Content: markdown rendered via TipTap `MarkdownEditor` in read-only preview mode
- Scrollable

### Step 9: Create CodeReviewLayout component

**New file:** `frontend/src/components/review/CodeReviewLayout.tsx`

Top-level component for the main content area.

```typescript
interface CodeReviewLayoutProps {
  laneId: string;
  workingDir: string;
}
```

**States:**
- `idle`: Centered empty state — icon, description, "Generate AI Summary and Review" button
- `loading`: Spinner + "Generating review..." with file count progress
- `ready`: Horizontal split — `ReviewSummaryPanel` (left, 50%) | `ResizeHandle` | `ReviewChangesPanel` (right, 50%)
- `error`: Error message + retry button

Reads from `codeReviewStore.getState(laneId)`.

### Step 10: Create CodeReviewFileList sidebar component

**New file:** `frontend/src/components/review/CodeReviewFileList.tsx`

Sidebar content when Code Review tab is active. Simplified file list.

- Header: file count, +/- totals
- File list: status badge, filename, directory breadcrumb (reuses `CodeReviewChanges.tsx` styling)
- Click handler: calls a callback that triggers `scrollToFile(path)` on `ReviewFileScrollView`
- Currently visible file highlighted (based on `visibleFilePath` from scroll tracking)
- Shows "No changes" empty state when no files

### Step 11: Wire into MainLayout, Sidebar, TopBar

**Modify:** `frontend/src/components/layout/MainLayout.tsx`

When `activeView() === ActivityView.CodeReview`:
- Hide AgentTerminalPanel (`display: 'none'`)
- Replace EditorPanel with `CodeReviewLayout`
- Sidebar renders `CodeReviewFileList`
- Bottom panel still visible (agent terminal for follow-up questions)

```tsx
<div style={{ display: [ActivityView.GitManager, ActivityView.CodeReview].includes(activeView()) ? 'none' : 'contents' }}>
  <AgentTerminalPanel ... />
</div>

<Show when={activeView() === ActivityView.CodeReview}>
  <CodeReviewLayout laneId={lane().id} workingDir={getEffectiveWorkingDir(lane())} />
</Show>

<Show when={activeView() !== ActivityView.CodeReview && showEditor()}>
  <EditorPanel ... />
</Show>
```

**Modify:** `frontend/src/components/layout/Sidebar.tsx`

- Add `<Match when={props.activeView === ActivityView.CodeReview}>` → `<CodeReviewFileList />`
- Update `getViewTitle()` for CodeReview → `'Code Review'`

**Modify:** `frontend/src/components/layout/TopBar.tsx`

- When `activeView === ActivityView.CodeReview`:
  - Show "Generate AI Review" / "Regenerate" button
  - Loading state from `codeReviewStore.getState(laneId).status`
  - Calls `codeReviewStore.generateReview()` instead of old `handleGenerateAIReview`
- Existing GitManager buttons (AI Summary, Commit) unchanged

### Step 12: Bottom panel AI agent terminal integration

The bottom panel already supports terminal tabs per lane. When the user generates a review:

- `CodeReviewStore.generateReview()` after completion creates/activates a terminal tab in the bottom panel
- The terminal pre-loads the agent with review context (diffs + summary) as an initial message or environment context
- Uses existing `TabManager` and `PortablePty` infrastructure
- The terminal tab is labeled "AI Review Agent" to distinguish from regular terminals

This step may require:
- A method on the terminal/tab system to create a tab with pre-loaded context
- Passing the review context string to the agent's initial prompt

### Step 13: Add Code Review settings page

**Modify:** `frontend/src/components/settings/types.ts`
- Add `'code-review'` to `SettingsTab` union and `NAV_ITEMS`

**New file:** `frontend/src/components/settings/CodeReviewSettings.tsx`
- AI Tool dropdown
- AI Model dropdown (per tool, uses `AI_MODELS`)
- Review Prompt textarea + "Reset to Default"
- Per-File Feedback Prompt textarea + "Reset to Default"

**Modify:** `frontend/src/components/settings/SettingsDialog.tsx`
- Add `<Show when={activeTab() === 'code-review'}>` → `<CodeReviewSettings />`

**Modify:** `frontend/src/components/settings/SettingsNavIcon.tsx`
- Add `'code-review'` icon case

## Files Summary

### New Files (9)
| File | Purpose |
|------|---------|
| `frontend/src/services/CodeReviewStore.ts` | Per-lane reactive store for review state |
| `frontend/src/services/CodeReviewSettingsManager.ts` | Settings persistence (localStorage + signals) |
| `frontend/src/components/review/CodeReviewLayout.tsx` | Main content: empty/loading/ready/error states, horizontal split |
| `frontend/src/components/review/ReviewSummaryPanel.tsx` | Left half: AI markdown summary (read-only) |
| `frontend/src/components/review/ReviewChangesPanel.tsx` | Right half: vertical split orchestrator |
| `frontend/src/components/review/ReviewFileScrollView.tsx` | Scrollable file-by-file diffs + IntersectionObserver |
| `frontend/src/components/review/FileContextPanel.tsx` | Per-file feedback panel (resizable, max 1/3) |
| `frontend/src/components/review/CodeReviewFileList.tsx` | Sidebar file list for Code Review tab |
| `frontend/src/components/settings/CodeReviewSettings.tsx` | Settings page for prompts + AI tool/model |

### Modified Files (8)
| File | Changes |
|------|---------|
| `frontend/src/services/AIReviewService.ts` | Public prompts, enhanced prompt, file review method |
| `frontend/src/components/layout/MainLayout.tsx` | Render CodeReviewLayout, hide terminal/editor |
| `frontend/src/components/layout/TopBar.tsx` | Wire generate button to CodeReviewStore |
| `frontend/src/components/layout/ActivityBar.tsx` | Add CodeReview enum + activity item |
| `frontend/src/components/layout/Sidebar.tsx` | Add CodeReview match → CodeReviewFileList |
| `frontend/src/components/settings/types.ts` | Add code-review tab |
| `frontend/src/components/settings/SettingsDialog.tsx` | Render CodeReviewSettings |
| `frontend/src/components/settings/SettingsNavIcon.tsx` | Add code-review icon |

### Reused Without Modification
| File | How Reused |
|------|-----------|
| `frontend/src/components/editor/DiffViewer.tsx` | Inline per file in ReviewFileScrollView |
| `frontend/src/hooks/useGitChanges.ts` | File change tracking in CodeReviewStore |
| `frontend/src/lib/git-api.ts` | Git diffs in CodeReviewStore |
| `frontend/src/components/layout/ResizeHandle.tsx` | Left/right and top/bottom splits |
| `frontend/src/services/EditorSettingsManager.ts` | Pattern reference |
| `frontend/src/services/TabManager.ts` | Bottom panel tab creation for AI agent |

## Implementation Order

1. **Steps 1-3:** Services (CodeReviewStore, AIReviewService, CodeReviewSettingsManager)
2. **Step 4:** ActivityBar (add tab, renders placeholder initially)
3. **Steps 5-8:** UI components (FileContextPanel, ReviewFileScrollView, ReviewChangesPanel, ReviewSummaryPanel)
4. **Step 9:** CodeReviewLayout (composes UI with state)
5. **Step 10:** CodeReviewFileList (sidebar component)
6. **Step 11:** Wire into MainLayout, Sidebar, TopBar
7. **Step 12:** Bottom panel agent terminal integration
8. **Step 13:** Settings page

## Verification

1. `make dev` — app builds and runs
2. New "Code Review" icon in activity bar (4th tab)
3. Click Code Review → empty state with "Generate" button
4. Click "Generate" → spinner → two-pane layout
5. Left: AI summary markdown, scrollable, read-only
6. Right top: file-by-file diffs, smart-sorted, sticky headers
7. Right bottom: context panel updates on scroll, shows per-file feedback
8. Sidebar: file list with status badges, click scrolls to file in diff view
9. Bottom panel: AI agent terminal with review context
10. Resize handles work (left/right split, context panel height)
11. Settings → Code Review: customize prompt, tool, model
12. Lane switching: independent review state per lane
13. Git Manager tab still works independently
