# Code Review Tab - Implementation Plan

## Recent Updates (2026-02-17)

### Performance: Parallel Processing
- **Configurable Concurrency**: Added `concurrency` setting (default: 4) to control how many files are processed in parallel
- Users can adjust between 1-8 concurrent file reviews via settings
- Change location: `CodeReviewSettingsManager` + `ReviewOrchestrator`
- Previous hardcoded limit: 3 → Now configurable with default: 4

### Smart Handling: Diff Truncation & File Filtering
- **Smart Diff Truncation**: Large diffs (>500 lines or >50KB) are intelligently truncated to save tokens
  - Extracts: file metadata, function signatures, imports, first N lines of each hunk
  - Prevents token limit errors while maintaining useful context
  - Location: `utils/diffTruncation.ts`

- **Configurable File Filtering**: Users can control which file types to exclude from review
  - **Categories** (toggle on/off):
    - Documentation (.md, .txt, .rst) — default: excluded
    - Lock files (package-lock.json, Cargo.lock) — default: excluded
    - Generated files (.min.js, .bundle.js) — default: excluded
    - Binary files (images, fonts, archives) — default: excluded
    - Test files (*.test.ts, *.spec.js) — default: included
    - Config files (tsconfig.json, .eslintrc) — default: included
  - **Custom patterns**: Add glob patterns like "*.generated.ts" or "*/migrations/*"
  - **Always excluded**: node_modules/, dist/, .git/, coverage/ (regardless of settings)
  - Location: `CodeReviewSettingsManager` + `utils/fileFilters.ts`

- **Integration**: Both features integrated into `ReviewOrchestrator`
  - Truncation applied to both summary and per-file reviews
  - Filtering uses user settings with sensible defaults
  - Exclusion summary logged to console for debugging

---

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

---

# Code Review Tab - Architecture Analysis & Recommendations

**Date:** 2026-02-17
**Status:** ✅ Implementation Complete → Architecture Review

## Executive Summary

The Code Review tab has been successfully implemented with all planned features working. However, a deep architecture review reveals **10 critical areas** that need improvement for robustness, modularity, and maintainability. This document provides a comprehensive analysis and actionable refactoring plan.

---

## Current Architecture Overview

### Component Hierarchy
```
CodeReviewLayout (main container)
├── ReviewSummaryPanel (left - AI summary)
└── ReviewChangesPanel (right - split view)
    ├── ReviewFileScrollView (top 66% - file diffs)
    └── FileContextPanel (bottom 33% - per-file feedback)
└── CodeReviewAgentPanel (bottom terminal)
```

### State Management
- **CodeReviewStore**: Centralized reactive store using SolidJS signals
- **CodeReviewSettingsManager**: Settings persistence (localStorage)
- **Per-lane state isolation**: Each lane has independent review state

### Backend Integration
- **Tauri Commands**: `ai_generate_review` in `src-tauri/src/ai.rs`
- **AI Tool Support**: claude, aider, opencode, gemini
- **Git Operations**: Via git-api wrappers

---

## 🔴 Critical Issues Identified

### 1. **State Management Anti-patterns**

**Location:** [CodeReviewStore.ts:98-273](frontend/src/services/CodeReviewStore.ts#L98-L273)

**Problem:** Single store handles too many concerns
```typescript
// CodeReviewStore.ts - Lines 98-273
// Single store handles:
// - Review generation orchestration
// - State management
// - API calls
// - File sorting
// - Scroll position tracking
```

**Impact:**
- Hard to test individual concerns
- Violates Single Responsibility Principle
- Difficult to extend or modify behavior
- 175 lines of complex orchestration code

**Recommendation:** Extract into focused services:
```typescript
// Proposed structure:
CodeReviewStore (state only - ~50 lines)
├── ReviewGenerationService (orchestration - ~80 lines)
├── ReviewScrollService (scroll tracking - ~30 lines)
└── ReviewFileService (file operations - ~40 lines)
```

**Benefits:**
- Each service testable in isolation
- Clear separation of concerns
- Easier to mock for testing
- Simpler mental model

---

### 2. **Agent Terminal Initialization Issues**

**Location:** [CodeReviewAgentPanel.tsx:36-115](frontend/src/components/review/CodeReviewAgentPanel.tsx#L36-L115)

**Problem:** Overly complex initialization with timing dependencies
```typescript
// Multiple signals tracking initialization state:
// - terminalInitialized
// - terminalRefReady
// - reviewState().status
// - createEffect with complex conditional logic
```

**Current Issues:**
- Race conditions between ref availability and state
- Console logs littered throughout (lines 39, 46, 49, 67, 153, 160, 168)
- Manual timeout for welcome message (line 89)
- Brittle initialization sequence
- Hard to debug when things go wrong

**Recommendation:** Extract into composable hook
```typescript
// hooks/useCodeReviewTerminal.ts
const useCodeReviewTerminal = (props: {
  workingDir: string;
  enabled: boolean;
}) => {
  const { terminal, pty, spawn, kill } = useTerminalInstance({
    workingDir: props.workingDir,
    onReady: async () => {
      const settings = await getAgentSettings();
      sendWelcomeMessage(terminal, settings.defaultAgent);
    },
  });

  return { terminal, isReady: () => !!pty };
};
```

**Benefits:**
- Single source of truth for initialization
- Composable and testable
- Clear lifecycle management
- Remove all console logs

---

### 3. **No Error Boundaries**

**Problem:** Component failures crash the entire tab

**Current Behavior:**
- If DiffViewer crashes → entire review tab crashes
- If markdown rendering fails → white screen
- User loses all context and work

**Recommendation:** Add SolidJS ErrorBoundary
```typescript
// components/review/ReviewErrorBoundary.tsx
export function ReviewErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <ReviewErrorFallback
          error={err}
          onRetry={reset}
          onReport={() => reportError(err)}
        />
      )}
    >
      {props.children}
    </ErrorBoundary>
  );
}

// In CodeReviewLayout:
<ReviewErrorBoundary>
  <CodeReviewLayout {...props} />
</ReviewErrorBoundary>
```

---

### 4. **Duplicate Markdown Rendering Logic**

**Location:**
- [ReviewSummaryPanel.tsx:68-195](frontend/src/components/review/ReviewSummaryPanel.tsx#L68-L195) (127 lines)
- [FileContextPanel.tsx:103-146](frontend/src/components/review/FileContextPanel.tsx#L103-L146) (43 lines)

**Problem:** Two separate markdown parsers with different features

**Differences:**
| Feature | ReviewSummaryPanel | FileContextPanel |
|---------|-------------------|------------------|
| Code blocks | ✅ Full support | ❌ Not supported |
| Blockquotes | ✅ Supported | ❌ Not supported |
| Ordered lists | ✅ Supported | ✅ Supported |
| Horizontal rules | ✅ Supported | ❌ Not supported |
| Nested lists | ❌ Not supported | ❌ Not supported |

**Impact:**
- Inconsistent rendering between panels
- Bug fixes need to be duplicated
- Larger bundle size
- Hard to add features (e.g., syntax highlighting)

**Recommendation:** Extract into shared utility
```typescript
// lib/markdown/MarkdownRenderer.tsx
export interface MarkdownOptions {
  mode: 'full' | 'simple';  // Controls feature set
  classNames?: string;       // Custom Tailwind classes
}

export function MarkdownRenderer(props: {
  markdown: string;
  options?: MarkdownOptions;
}) {
  const html = createMemo(() =>
    renderMarkdown(props.markdown, props.options?.mode || 'full')
  );

  return (
    <div
      class={props.options?.classNames}
      innerHTML={html()}
    />
  );
}
```

---

### 5. **Tight Coupling to Tauri Backend**

**Location:** Direct invoke calls scattered across codebase

**Problem:** No abstraction layer
```typescript
// CodeReviewStore.ts:162
invoke<FileChangeStats[]>('git_sort_files', {...})

// CodeReviewStore.ts:56
invoke<AIReviewResult>('ai_generate_review', {...})

// AIReviewService.ts:56
invoke<AIReviewResult>('ai_generate_review', {...})
```

**Impact:**
- Impossible to test without Tauri runtime
- Cannot mock AI responses for development
- No retry logic or caching
- Hard to add offline mode

**Recommendation:** API abstraction layer
```typescript
// services/api/ReviewAPI.ts
export class ReviewAPI {
  async generateReview(params: ReviewParams): Promise<AIReviewResult> {
    try {
      return await invoke('ai_generate_review', params);
    } catch (err) {
      // Retry logic, error handling
      throw new ReviewAPIError(err);
    }
  }

  async sortFiles(files: FileChangeStats[], order: SortOrder): Promise<FileChangeStats[]> {
    // Cache results, handle errors
    return invoke('git_sort_files', { files, sortOrder: order });
  }
}

// For testing:
export class MockReviewAPI extends ReviewAPI {
  async generateReview(params: ReviewParams) {
    return mockAIResponse;
  }
}
```

---

### 6. **Missing Granular Loading States**

**Location:** [CodeReviewStore.ts:16-29](frontend/src/services/CodeReviewStore.ts#L16-L29)

**Problem:** Only 4 coarse states
```typescript
export type ReviewStatus = 'idle' | 'loading' | 'ready' | 'error';
```

**During "loading" (lines 98-262):**
1. Fetching changes (line 121)
2. Fetching diffs (lines 142-152) - could take 5-30s for many files
3. Sorting files (line 162)
4. Generating summary (line 186) - could take 10-60s
5. Generating per-file feedback (lines 226-258) - could take 1-5 minutes

**User Experience:**
- Sees "Generating review..." for 2+ minutes
- No idea what's happening
- Cannot see progress
- Thinks app is frozen

**Recommendation:**
```typescript
type ReviewPhase =
  | 'idle'
  | 'fetching-changes'
  | 'fetching-diffs'
  | 'sorting-files'
  | 'generating-summary'
  | 'generating-file-feedback'
  | 'ready'
  | 'error';

interface ReviewProgress {
  phase: ReviewPhase;
  totalFiles: number;
  processedFiles: number;
  currentFile: string | null;
  estimatedTimeRemaining?: number;
}

// UI shows:
// "Fetching diffs... (3/15 files)"
// "Generating AI summary..."
// "Analyzing files... (8/15 complete)"
```

---

### 7. **Performance Concerns**

#### 7.1 IntersectionObserver Complexity

**Location:** [ReviewFileScrollView.tsx:42-128](frontend/src/components/review/ReviewFileScrollView.tsx#L42-L128)

**Problem:** Inefficient observer callback
```typescript
const observer = new IntersectionObserver((entries) => {
  // Lines 74-88: O(n) search on every intersection change
  for (const path of visibleFiles) {
    const idx = pathIndexMap().get(path) ?? Infinity;
    if (idx < minIdx) {
      minIdx = idx;
      topmost = path;
    }
  }
});
```

**Impact:**
- Callback fires on every scroll event
- O(n) loop for every callback
- Can cause jank with 20+ files

**Recommendation:**
```typescript
// Debounce observer callbacks
const debouncedUpdate = debounce((topmost: string) => {
  props.onVisibleFileChange(topmost);
}, 100);

// Use sorted index for O(1) topmost lookup
const getTopmostFile = (visibleFiles: Set<string>) => {
  // Binary search or pre-sorted array
};
```

#### 7.2 Large Diffs in Memory

**Problem:** All file diffs loaded into memory
```typescript
// CodeReviewStore.ts:142
const fileDiffs = new Map<string, string>();
for (const file of changesWithStats) {
  const diff = await getGitDiff(workingDir, file.path, false);
  fileDiffs.set(file.path, diff);  // Could be 100+ KB per file
}
```

**Impact:**
- 50 files × 50 KB = 2.5 MB in memory
- No virtualization
- Slow initial load

**Recommendation:**
```typescript
// Lazy load diffs on demand
const useLazyDiff = (filePath: string) => {
  const [diff, setDiff] = createSignal<string | null>(null);

  createEffect(() => {
    if (isNearViewport(filePath)) {
      loadDiff(filePath).then(setDiff);
    }
  });

  return diff;
};
```

#### 7.3 No Request Cancellation

**Problem:** AI requests cannot be cancelled
```typescript
// User generates review → navigates away → requests still running
await aiReviewService.generateReview({...});  // No abort signal
```

**Recommendation:**
```typescript
// Add AbortController support
const controller = new AbortController();

try {
  const result = await generateReview(params, {
    signal: controller.signal,
  });
} catch (err) {
  if (err.name === 'AbortError') {
    // Cleanup
  }
}

// On unmount:
onCleanup(() => controller.abort());
```

---

### 8. **Accessibility Issues**

**Problem:** Missing ARIA attributes and keyboard navigation

**Examples:**

1. **File list not keyboard navigable** ([CodeReviewFileList.tsx:112-142](frontend/src/components/review/CodeReviewFileList.tsx#L112-L142))
```typescript
// Current: <button onClick={...}>
// Should be:
<button
  role="option"
  aria-selected={isVisible}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleClick();
  }}
>
```

2. **No skip links** - Users must tab through entire file list to reach content

3. **Status changes not announced** - Screen reader users don't know when review completes

**Recommendation:**
```typescript
// Add live region for status updates
<div role="status" aria-live="polite" class="sr-only">
  {reviewState().phase === 'generating-summary' && 'Generating AI summary'}
  {reviewState().phase === 'ready' && 'Review complete'}
</div>

// Add keyboard shortcuts
useHotkey('/', () => focusFileSearch());
useHotkey('j/k', () => navigateFiles());
useHotkey('r', () => regenerateReview());
```

---

### 9. **Settings Management Complexity**

**Location:** [CodeReviewSettingsManager.ts](frontend/src/services/CodeReviewSettingsManager.ts)

**Problem:** Single file handles too many concerns
```typescript
// Lines 1-151 handle:
// 1. Type definitions
// 2. localStorage persistence
// 3. Migration from legacy keys
// 4. Reactive signals
// 5. Public API
```

**Recommendation:** Separate concerns
```typescript
// settings/storage/SettingsStorage.ts
export class SettingsStorage {
  load(key: string): unknown;
  save(key: string, value: unknown): void;
}

// settings/migration/SettingsMigration.ts
export function migrateLegacyKeys(): Partial<CodeReviewSettings>;

// settings/provider/SettingsProvider.tsx
export function SettingsProvider(props: { children: JSX.Element }) {
  const storage = new SettingsStorage();
  const [settings, setSettings] = createSignal(storage.load());
  // ...
}
```

---

### 10. **No Telemetry or Analytics**

**Problem:** Zero visibility into production usage

**Unknown Metrics:**
- How long do reviews actually take?
- Which AI tools are most popular?
- Common failure points?
- User engagement (regeneration rate, file drill-down rate)?
- Performance bottlenecks?

**Recommendation:**
```typescript
// services/analytics/ReviewAnalytics.ts
export const reviewAnalytics = {
  trackReviewStarted: (tool: AITool, fileCount: number) => {
    // Send to analytics
  },

  trackReviewCompleted: (tool: AITool, duration: number, success: boolean) => {
    // Track completion
  },

  trackFileViewed: (filePath: string, dwellTime: number) => {
    // Track engagement
  },

  trackError: (phase: ReviewPhase, error: Error) => {
    // Track failures
  },
};
```

---

## ✅ Recommended Refactoring Plan

### Phase 1: Critical Fixes (Week 1)
**Goal:** Improve stability and UX with minimal risk

- [ ] **Add Error Boundaries** - Wrap main components
  - Priority: 🔴 Critical
  - Impact: High (prevents crashes)
  - Risk: Low
  - Effort: 2 hours

- [ ] **Extract Markdown Renderer** - Single source of truth
  - Priority: 🟡 Medium
  - Impact: Medium (consistency)
  - Risk: Low
  - Effort: 3 hours

- [ ] **Add Granular Loading States** - Better progress indication
  - Priority: 🔴 Critical
  - Impact: High (UX improvement)
  - Risk: Low
  - Effort: 4 hours

- [ ] **Remove Console Logs** - Clean up debug statements
  - Priority: 🟢 Low
  - Impact: Low (cleanliness)
  - Risk: None
  - Effort: 30 minutes

### Phase 2: Architecture Improvements (Week 2-3)
**Goal:** Make code more maintainable and testable

- [ ] **Extract Services from Store**
  - ReviewGenerationService
  - ReviewScrollService
  - ReviewFileService
  - Priority: 🟡 Medium
  - Impact: High (testability)
  - Risk: Medium
  - Effort: 8 hours

- [ ] **Create API Abstraction Layer**
  - ReviewAPI interface
  - Mock implementation for tests
  - Priority: 🟡 Medium
  - Impact: High (testability)
  - Risk: Low
  - Effort: 4 hours

- [ ] **Simplify Terminal Initialization**
  - Extract useCodeReviewTerminal hook
  - Remove complex state tracking
  - Priority: 🟡 Medium
  - Impact: Medium (stability)
  - Risk: Medium
  - Effort: 4 hours

- [ ] **Add Request Cancellation**
  - AbortController support
  - Cleanup on unmount
  - Priority: 🟡 Medium
  - Impact: Medium (performance)
  - Risk: Low
  - Effort: 3 hours

### Phase 3: Performance & Polish (Week 4)
**Goal:** Optimize for large changesets and improve accessibility

- [ ] **Optimize IntersectionObserver**
  - Debounce callbacks
  - Optimize topmost file lookup
  - Priority: 🟢 Low
  - Impact: Medium (performance)
  - Risk: Low
  - Effort: 3 hours

- [ ] **Add Diff Virtualization**
  - Lazy load diffs on demand
  - Unload off-screen diffs
  - Priority: 🟢 Low
  - Impact: High (performance for large changesets)
  - Risk: Medium
  - Effort: 6 hours

- [ ] **Memoization Strategy**
  - Audit createMemo usage
  - Add memos for expensive computations
  - Priority: 🟢 Low
  - Impact: Medium (performance)
  - Risk: Low
  - Effort: 2 hours

- [ ] **Accessibility Improvements**
  - ARIA attributes
  - Keyboard navigation
  - Screen reader support
  - Priority: 🟡 Medium
  - Impact: High (inclusivity)
  - Risk: Low
  - Effort: 8 hours

### Phase 4: Infrastructure (Ongoing)
**Goal:** Enable long-term maintainability

- [ ] **Unit Tests**
  - Test services and utilities
  - Target: 80% coverage
  - Priority: 🟡 Medium
  - Effort: 12 hours

- [ ] **Component Tests**
  - Test isolated components
  - Target: Critical paths
  - Priority: 🟢 Low
  - Effort: 8 hours

- [ ] **Integration Tests**
  - Test full flows
  - Target: Happy path + error cases
  - Priority: 🟢 Low
  - Effort: 8 hours

- [ ] **Add Telemetry**
  - Track usage and performance
  - Set up error reporting
  - Priority: 🟢 Low
  - Effort: 6 hours

- [ ] **Documentation**
  - JSDoc for complex functions
  - Architecture diagrams
  - README updates
  - Priority: 🟢 Low
  - Effort: 4 hours

---

## 🎯 Proposed Architecture (After Refactoring)

### Service Layer
```
services/
├── review/
│   ├── ReviewOrchestrator.ts        // Coordinates review generation
│   ├── ReviewStateManager.ts         // Pure state management (signals)
│   ├── ReviewFileProcessor.ts        // File diff operations
│   ├── ReviewScrollCoordinator.ts    // Scroll sync logic
│   └── ReviewAPI.ts                  // Backend abstraction
│
├── terminal/
│   ├── TerminalLifecycle.ts          // Init/cleanup logic
│   └── TerminalMessageService.ts     // Welcome messages, prompts
│
├── ai/
│   ├── AIProviderFactory.ts          // Creates tool-specific providers
│   ├── providers/
│   │   ├── ClaudeProvider.ts
│   │   ├── AiderProvider.ts
│   │   ├── OpencodeProvider.ts
│   │   └── GeminiProvider.ts
│   └── AIResponseCache.ts            // Cache AI responses
│
└── analytics/
    └── ReviewAnalytics.ts            // Usage tracking
```

### Component Structure
```
components/review/
├── CodeReviewLayout.tsx              // Layout orchestrator
│
├── panels/
│   ├── ReviewSummaryPanel.tsx        // Left: AI summary
│   ├── ReviewChangesPanel.tsx        // Right: split orchestrator
│   ├── FileContextPanel.tsx          // Bottom: per-file feedback
│   └── AgentTerminalPanel.tsx        // Bottom: AI terminal
│
├── views/
│   ├── ReviewFileList.tsx            // Sidebar: file list
│   └── ReviewFileScrollView.tsx      // Main: scrollable diffs
│
├── shared/
│   ├── MarkdownRenderer.tsx          // Unified markdown rendering
│   ├── FileStatusBadge.tsx           // Reusable status badge
│   ├── ReviewErrorBoundary.tsx       // Error handling
│   └── ReviewLoadingState.tsx        // Loading indicators
│
└── hooks/
    ├── useReviewState.ts             // Access review state
    ├── useReviewTerminal.ts          // Terminal lifecycle
    ├── useFileScrollSync.ts          // Scroll coordination
    ├── useReviewGeneration.ts        // Trigger generation
    └── useReviewAnalytics.ts         // Track events
```

---

## 📋 Best Practices to Follow

### 1. Component Design
- ✅ **Single Responsibility**: Each component does one thing well
- ✅ **Props over Context**: Explicit data flow (easier to debug)
- ✅ **Composable Hooks**: Extract reusable logic
- ✅ **Error Boundaries**: Isolate failures

### 2. State Management
- ✅ **Separate read/write**: Accessor functions for reads, methods for writes
- ✅ **Immutable updates**: Never mutate state directly
- ✅ **Derived state**: Use createMemo for computed values
- ✅ **Per-lane isolation**: No shared state between lanes

### 3. Performance
- ✅ **Lazy rendering**: Only render visible content
- ✅ **Memoization**: Cache expensive computations
- ✅ **Debouncing**: Reduce observer/handler callbacks
- ✅ **Code splitting**: Lazy load heavy components

### 4. Error Handling
- ✅ **User-friendly messages**: No raw stack traces
- ✅ **Retry mechanisms**: For transient failures
- ✅ **Fallback UI**: Always show something useful
- ✅ **Logging**: Track errors for debugging

### 5. Testing
- ✅ **Unit tests**: For pure functions and services
- ✅ **Component tests**: For isolated components
- ✅ **Integration tests**: For full flows
- ✅ **E2E tests**: For critical user paths

### 6. Documentation
- ✅ **JSDoc comments**: For complex functions
- ✅ **Architecture diagrams**: Visual documentation
- ✅ **README**: Setup and usage instructions
- ✅ **CHANGELOG**: Track breaking changes

---

## 🚀 Implementation Timeline

### Week 1: Critical Fixes
- Days 1-2: Error boundaries + loading states
- Days 3-4: Extract markdown renderer
- Day 5: Clean up console logs, testing

### Week 2-3: Architecture
- Week 2: Extract services, API layer
- Week 3: Terminal refactor, cancellation support

### Week 4: Performance & Polish
- Days 1-2: IntersectionObserver optimization
- Days 3-4: Diff virtualization
- Day 5: Accessibility audit and fixes

### Ongoing: Infrastructure
- Add tests incrementally
- Set up telemetry
- Document as you go

---

## 📊 Success Metrics

### Stability
- Zero unhandled errors reaching users
- < 1% error rate on review generation
- Graceful degradation on failures

### Performance
- Review generation < 60s for 20 files
- Scroll jank < 5% of the time
- Memory usage < 100 MB for 50 files

### Code Quality
- 80% test coverage for services
- Zero linter warnings
- All components documented

### User Experience
- Clear progress indication
- Keyboard navigation works
- Screen reader compatible

---

## 📖 References

- [SolidJS Best Practices](https://www.solidjs.com/guides/best-practices)
- [SolidJS Error Boundaries](https://www.solidjs.com/tutorial/flow_error_boundary)
- [Web Accessibility (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
- [IntersectionObserver Performance](https://web.dev/intersectionobserver-v2/)
- [AbortController API](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

---

## 💡 Key Takeaways

1. **Current implementation works** but has technical debt
2. **Refactoring should be incremental** to avoid breaking changes
3. **Focus on high-impact, low-risk improvements first**
4. **Add tests before major refactoring** to prevent regressions
5. **Use feature flags** for risky changes
6. **Monitor with telemetry** to validate improvements
7. **Document as you refactor** to maintain knowledge

The architecture is sound but needs refinement. Following this plan will make the Code Review tab more robust, maintainable, and scalable for future features.
---

# Code Review Error Boundary Implementation

**Date:** 2026-02-17
**Status:** ✅ COMPLETE

## Summary

Successfully implemented a comprehensive Error Boundary system for the Code Review tab. The system catches and recovers from errors without crashing the entire application.

## Files Created

1. **`/frontend/src/components/review/shared/ReviewErrorBoundary.tsx`** (222 lines)
   - Main error boundary component using SolidJS ErrorBoundary
   - Custom fallback UI with Zed theme styling
   - User-friendly error messages
   - Retry button for error recovery
   - Collapsible technical details
   - Copy to clipboard functionality
   - Report Issue button (opens GitHub)

2. **`/frontend/src/components/review/shared/ErrorBoundaryTest.tsx`** (65 lines)
   - Test utility component for verifying error boundary functionality
   - Floating UI with "Throw Error" button
   - Instructions for testing different error scenarios

3. **`/ERROR_BOUNDARY_GUIDE.md`**
   - Complete guide to the error boundary system
   - Testing procedures
   - Error handling patterns
   - Best practices and limitations

## Files Modified

1. **`/frontend/src/components/review/index.ts`**
   - Added export for ReviewErrorBoundary

2. **`/frontend/src/components/layout/MainLayout.tsx`**
   - Imported ReviewErrorBoundary
   - Wrapped CodeReviewLayout with error boundary
   - Error boundary only wraps Code Review tab (doesn't affect other tabs)

## Implementation Details

### Error Fallback UI Features

- **Visual Design:**
  - Large error icon with pulse animation (red color scheme)
  - Clean, centered layout with Zed theme styling
  - User-friendly error title: "Something Went Wrong"

- **Error Messages:**
  - Context-aware mapping of technical errors to user-friendly messages
  - Network errors → "Network error: Could not connect to the backend service."
  - Timeout errors → "Request timed out: The operation took too long to complete."
  - Parse errors → "Data error: Received invalid response from the backend."
  - Other errors → Shows original error message

- **Action Buttons:**
  - **Retry** (primary purple button) - Resets error state and re-renders component
  - **Report Issue** (secondary button) - Opens GitHub with pre-filled error details

- **Technical Details Section:**
  - Collapsible section with arrow indicator
  - Displays: Error name, message, full stack trace, timestamp, user agent
  - Copy button with visual feedback ("Copied!")
  - Styled with monospace font for readability

### Integration in MainLayout.tsx

```tsx
<Show when={activeView() === ActivityView.CodeReview}>
  <ReviewErrorBoundary>
    <CodeReviewLayout
      laneId={lane().id}
      workingDir={getEffectiveWorkingDir(lane())}
    />
  </ReviewErrorBoundary>
</Show>
```

**Why this works:**
- Only wraps Code Review tab (other tabs unaffected)
- Errors in Code Review don't crash the entire app
- Error state preserved when switching tabs
- Users can continue using other functionality

## Testing Instructions

### Manual Testing Steps

1. **Install test component** (optional):
   ```tsx
   // In CodeReviewLayout.tsx:
   import { ErrorBoundaryTest } from './shared/ErrorBoundaryTest';
   // Add <ErrorBoundaryTest /> to JSX
   ```

2. **Trigger error:**
   - Click "Throw Error" button in test component
   - Or modify code to throw error in CodeReviewLayout

3. **Verify error UI:**
   - Error icon appears with pulse animation
   - User-friendly error message displays
   - Retry and Report buttons visible

4. **Test retry functionality:**
   - Click "Retry" button
   - Verify component re-renders
   - Error clears if condition resolved

5. **Test technical details:**
   - Click "Technical Details" to expand/collapse
   - Verify error information displays
   - Click "Copy" button
   - Verify clipboard has error info
   - Verify "Copied!" feedback appears

6. **Test error reporting:**
   - Click "Report Issue"
   - Verify GitHub opens with pre-filled error details

7. **Test isolation:**
   - Trigger an error in Code Review
   - Switch to other tabs (Explorer, Git Manager)
   - Verify other tabs still work
   - Return to Code Review
   - Verify error UI is still displayed

### Error Scenarios to Test

Test with different error types by modifying `ErrorBoundaryTest.tsx`:

```tsx
// Network error
throw new Error('fetch failed: Network error');

// Timeout error
throw new Error('Request timeout exceeded');

// Parse error
throw new Error('JSON parse error: Unexpected token');

// Generic error
throw new Error('Something went wrong');
```

## How It Works

### SolidJS ErrorBoundary Pattern

1. **Error occurs** → Component throws error during render
2. **Boundary catches** → SolidJS ErrorBoundary intercepts
3. **Fallback renders** → ReviewErrorFallback displays error UI
4. **User actions:**
   - Click "Retry" → Calls `reset()` → Re-renders component
   - Click "Report Issue" → Opens GitHub with error details
   - Click "Copy" → Copies technical details to clipboard
5. **Recovery** → Component re-renders, either succeeds or shows error again

## Build Status

- ✅ TypeScript: No compilation errors
- ✅ Rust: Cargo check passes (7 unrelated warnings)
- ✅ Integration: Properly wrapped in MainLayout
- ✅ Exports: All exports working correctly

## Limitations

1. **Doesn't catch:**
   - Event handler errors (use try/catch)
   - Async errors outside render (use try/catch)
   - Errors in the ErrorBoundary itself

2. **Recovery:**
   - Retry doesn't fix backend/network issues automatically
   - State may need manual reset in some cases
   - Some errors may persist on retry (e.g., data corruption)

## Future Enhancements

- [ ] Add error telemetry/logging integration
- [ ] Implement Safe Mode for repeated errors
- [ ] Add exponential backoff for automatic retries
- [ ] Add recovery suggestions based on error type
- [ ] Implement granular error boundaries per panel
- [ ] Add separate boundary for CodeReviewAgentPanel

## Next Steps

1. **Update GitHub URL** in `ReviewErrorBoundary.tsx`:
   - Line 79: Change `your-org/codelane` to actual repo URL

2. **Test in production:**
   - Run `make dev` to test in Tauri
   - Navigate to Code Review tab
   - Test various error scenarios

3. **Remove test component** when done:
   - Delete `ErrorBoundaryTest.tsx` import
   - Or keep for future testing

## Documentation

See `/ERROR_BOUNDARY_GUIDE.md` for complete documentation including:
- Detailed component breakdown
- Testing procedures
- Styling reference
- Best practices
- Integration examples
- References to SolidJS documentation

## Addresses Critical Issue #3

This implementation directly addresses **Critical Issue #3: No Error Boundaries** from the architecture review (lines 443-477 in this file).

**Previous Problem:**
- Component failures crashed entire tab
- No graceful error handling
- Users lost all context on crashes

**Solution Implemented:**
- ✅ SolidJS ErrorBoundary wrapper
- ✅ Custom fallback UI with error details
- ✅ Retry mechanism for recovery
- ✅ Error isolation (only affects Code Review tab)
- ✅ User-friendly error messages
- ✅ Technical details for debugging
- ✅ GitHub issue reporting

