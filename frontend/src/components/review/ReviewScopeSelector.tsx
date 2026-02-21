/**
 * ReviewScopeSelector - Scope toggle for feature lanes
 *
 * Shows a segmented control to switch between:
 * - "Working Changes" (uncommitted changes vs HEAD)
 * - "Branch vs {default}" (all commits on branch vs default branch)
 *
 * Only shown on feature lanes, not PR review lanes.
 */

export type ReviewScope = 'working_changes' | 'branch_diff';

interface ReviewScopeSelectorProps {
  currentScope: ReviewScope;
  baseBranch: string;
  onScopeChange: (scope: ReviewScope) => void;
}

export function ReviewScopeSelector(props: ReviewScopeSelectorProps) {
  return (
    <div class="flex items-center gap-3 px-4 py-2 border-b border-zed-border-subtle bg-zed-bg-panel">
      <span class="text-xs text-zed-text-tertiary font-medium">Reviewing:</span>
      <div class="flex gap-0.5 bg-zed-bg-app rounded-md p-0.5">
        <button
          class={`px-3 py-1 text-xs rounded transition-colors ${
            props.currentScope === 'working_changes'
              ? 'bg-zed-bg-hover text-zed-text-primary font-medium'
              : 'text-zed-text-secondary hover:text-zed-text-primary'
          }`}
          onClick={() => props.onScopeChange('working_changes')}
        >
          Working Changes
        </button>
        <button
          class={`px-3 py-1 text-xs rounded transition-colors ${
            props.currentScope === 'branch_diff'
              ? 'bg-zed-bg-hover text-zed-text-primary font-medium'
              : 'text-zed-text-secondary hover:text-zed-text-primary'
          }`}
          onClick={() => props.onScopeChange('branch_diff')}
        >
          Branch vs {props.baseBranch}
        </button>
      </div>
    </div>
  );
}
