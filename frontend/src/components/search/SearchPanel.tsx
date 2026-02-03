import { createSignal, createEffect, For, Show, onCleanup, createMemo, onMount } from 'solid-js';
import {
  searchStateManager,
  MATCHES_PER_FILE_PREVIEW,
  type FileSearchResults,
  type SearchMatch,
} from '../../services/SearchStateManager';

interface SearchPanelProps {
  workingDir: string;
  laneId: string;
  onFileOpen: (path: string, line: number, match?: { column: number; text: string }) => void;
}

export function SearchPanel(props: SearchPanelProps) {
  const [isMounted, setIsMounted] = createSignal(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let inputRef: HTMLInputElement | undefined;

  // Track mount state to prevent updates after unmount
  onMount(() => setIsMounted(true));
  onCleanup(() => setIsMounted(false));

  // Get reactive search state - only if mounted
  const searchState = createMemo(() => {
    if (!isMounted()) return {
      query: '',
      isRegex: false,
      caseSensitive: false,
      matchWord: false,
      includePattern: '',
      excludePattern: '',
      isSearching: false,
      totalMatches: 0,
      totalFiles: 0,
      error: null,
      truncated: false,
    };
    // Subscribe to updates
    searchStateManager.getUpdateSignal()();
    return searchStateManager.getSearchState(props.laneId);
  });

  // Convenience accessors for state
  const query = () => searchState().query;
  const isRegex = () => searchState().isRegex;
  const caseSensitive = () => searchState().caseSensitive;
  const matchWord = () => searchState().matchWord;
  const includePattern = () => searchState().includePattern;
  const excludePattern = () => searchState().excludePattern;

  // Get reactive results - only if mounted
  const results = createMemo(() => {
    if (!isMounted()) return [];
    // Subscribe to updates
    searchStateManager.getUpdateSignal()();
    return searchStateManager.getResults(props.laneId);
  });

  // Get pagination info
  const displayInfo = createMemo(() => {
    if (!isMounted()) return { displayedFiles: 0, totalFiles: 0, totalMatches: 0, hasMore: false };
    searchStateManager.getUpdateSignal()();
    return searchStateManager.getDisplayInfo(props.laneId);
  });

  // Debounced search
  const triggerSearch = (searchQuery: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      searchStateManager.startSearch(props.laneId, props.workingDir, searchQuery, {
        isRegex: isRegex(),
        caseSensitive: caseSensitive(),
        matchWord: matchWord(),
        includePattern: includePattern() || undefined,
        excludePattern: excludePattern() || undefined,
      });
    }, 300);
  };

  // Handle input change
  const handleInputChange = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    searchStateManager.updateQuery(props.laneId, value);
    triggerSearch(value);
  };

  // Handle toggle changes - re-trigger search
  const handleRegexToggle = () => {
    const newValue = !isRegex();
    searchStateManager.updateOptions(props.laneId, { isRegex: newValue });
    if (query().trim()) {
      triggerSearch(query());
    }
  };

  const handleCaseToggle = () => {
    const newValue = !caseSensitive();
    searchStateManager.updateOptions(props.laneId, { caseSensitive: newValue });
    if (query().trim()) {
      triggerSearch(query());
    }
  };

  const handleMatchWordToggle = () => {
    const newValue = !matchWord();
    searchStateManager.updateOptions(props.laneId, { matchWord: newValue });
    if (query().trim()) {
      triggerSearch(query());
    }
  };

  // Handle pattern changes
  const handleIncludePatternChange = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    searchStateManager.updateOptions(props.laneId, { includePattern: value });
    if (query().trim()) {
      triggerSearch(query());
    }
  };

  const handleExcludePatternChange = (e: InputEvent) => {
    const value = (e.target as HTMLInputElement).value;
    searchStateManager.updateOptions(props.laneId, { excludePattern: value });
    if (query().trim()) {
      triggerSearch(query());
    }
  };

  // Cancel search
  const handleCancel = () => {
    searchStateManager.cancelSearch(props.laneId);
  };

  // Clear search
  const handleClear = () => {
    searchStateManager.updateQuery(props.laneId, '');
    searchStateManager.clearResults(props.laneId);
  };

  // Toggle file collapse
  const handleFileToggle = (filePath: string) => {
    searchStateManager.toggleFileCollapse(props.laneId, filePath);
  };

  // Load more results
  const handleLoadMore = () => {
    searchStateManager.loadMore(props.laneId);
  };

  // Click on match
  const handleMatchClick = (match: SearchMatch) => {
    props.onFileOpen(match.file_path, match.line_number, {
      column: match.column,
      text: match.match_text,
    });
  };

  // Focus input on mount
  createEffect(() => {
    if (inputRef) {
      inputRef.focus();
    }
  });

  // Cleanup - cancel debounce and any ongoing search
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // Cancel any ongoing search to prevent state updates after unmount
    searchStateManager.cancelSearch(props.laneId);
  });

  // Get relative path from working dir
  const getRelativePath = (fullPath: string) => {
    if (fullPath.startsWith(props.workingDir)) {
      return fullPath.slice(props.workingDir.length + 1);
    }
    return fullPath;
  };

  return (
    <div class="h-full flex flex-col bg-zed-bg-panel">
      {/* Search Input */}
      <div class="p-3 border-b border-zed-border-subtle">
        <div class="relative">
          <input
            ref={inputRef}
            type="text"
            value={query()}
            onInput={handleInputChange}
            placeholder="Search files..."
            class="w-full px-3 py-1.5 pr-20 text-sm bg-zed-bg-surface border border-zed-border-subtle rounded focus:outline-none focus:border-zed-accent-blue text-zed-text-primary placeholder:text-zed-text-disabled"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
          />

          {/* Toggle buttons inside input */}
          <div class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              class={`p-1 rounded text-xs font-mono transition-colors ${
                caseSensitive()
                  ? 'bg-zed-accent-blue/20 text-zed-accent-blue'
                  : 'text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover'
              }`}
              onClick={handleCaseToggle}
              title="Match Case"
            >
              Aa
            </button>
            <button
              class={`p-1 rounded text-xs font-mono transition-colors ${
                matchWord()
                  ? 'bg-zed-accent-blue/20 text-zed-accent-blue'
                  : 'text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover'
              }`}
              onClick={handleMatchWordToggle}
              title="Match Whole Word"
            >
              W
            </button>
            <button
              class={`p-1 rounded text-xs font-mono transition-colors ${
                isRegex()
                  ? 'bg-zed-accent-blue/20 text-zed-accent-blue'
                  : 'text-zed-text-tertiary hover:text-zed-text-secondary hover:bg-zed-bg-hover'
              }`}
              onClick={handleRegexToggle}
              title="Use Regular Expression"
            >
              .*
            </button>
          </div>
        </div>

        {/* File Pattern Filters */}
        <div class="mt-2 space-y-1.5">
          <input
            type="text"
            value={includePattern()}
            onInput={handleIncludePatternChange}
            placeholder="Files to include (e.g., *.ts, src/**)"
            class="w-full px-2 py-1 text-xs bg-zed-bg-surface border border-zed-border-subtle rounded focus:outline-none focus:border-zed-accent-blue text-zed-text-primary placeholder:text-zed-text-disabled"
            autocomplete="off"
            spellcheck={false}
          />
          <input
            type="text"
            value={excludePattern()}
            onInput={handleExcludePatternChange}
            placeholder="Files to exclude (e.g., *.test.ts, node_modules/**)"
            class="w-full px-2 py-1 text-xs bg-zed-bg-surface border border-zed-border-subtle rounded focus:outline-none focus:border-zed-accent-blue text-zed-text-primary placeholder:text-zed-text-disabled"
            autocomplete="off"
            spellcheck={false}
          />
        </div>

        {/* Search Stats */}
        <div class="mt-2 flex items-center justify-between text-xs text-zed-text-tertiary">
          <Show
            when={searchState().isSearching}
            fallback={
              <Show when={query().trim()}>
                <span>
                  {displayInfo().totalMatches} results in {displayInfo().totalFiles} files
                  <Show when={displayInfo().hasMore}>
                    {' '}(showing {displayInfo().displayedFiles})
                  </Show>
                </span>
              </Show>
            }
          >
            <span class="flex items-center gap-2">
              <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </span>
          </Show>

          <div class="flex items-center gap-2">
            <Show when={searchState().isSearching}>
              <button
                class="text-zed-text-tertiary hover:text-zed-accent-red transition-colors"
                onClick={handleCancel}
                title="Cancel search"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Show>
            <Show when={query().trim() && !searchState().isSearching}>
              <button
                class="text-zed-text-tertiary hover:text-zed-text-primary transition-colors"
                onClick={handleClear}
                title="Clear search"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Show>
          </div>
        </div>
      </div>

      {/* Error State */}
      <Show when={searchState().error}>
        <div class="px-4 py-3 text-sm text-zed-accent-red bg-zed-accent-red/10 border-b border-zed-border-subtle">
          {searchState().error}
        </div>
      </Show>

      {/* Truncated Warning */}
      <Show when={searchState().truncated && !searchState().isSearching}>
        <div class="px-4 py-2 text-xs text-zed-accent-yellow bg-zed-accent-yellow/10 border-b border-zed-border-subtle">
          Results limited to {searchState().totalMatches} matches. Try a more specific search.
        </div>
      </Show>

      {/* Results */}
      <div class="flex-1 overflow-auto">
        <Show
          when={results().length > 0}
          fallback={
            <Show when={query().trim() && !searchState().isSearching}>
              <div class="px-4 py-8 text-center text-xs text-zed-text-tertiary">
                <svg
                  class="w-8 h-8 mx-auto mb-2 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <p>No results found</p>
                <p class="text-zed-text-disabled mt-1">Try a different search term</p>
              </div>
            </Show>
          }
        >
          <For each={results()}>
            {(fileResult) => (
              <FileResultGroup
                fileResult={fileResult}
                workingDir={props.workingDir}
                query={query()}
                isRegex={isRegex()}
                caseSensitive={caseSensitive()}
                matchWord={matchWord()}
                laneId={props.laneId}
                showAllMatches={!searchState().truncated}
                onToggle={() => handleFileToggle(fileResult.filePath)}
                onMatchClick={handleMatchClick}
              />
            )}
          </For>

          {/* Load More Button */}
          <Show when={displayInfo().hasMore && !searchState().isSearching}>
            <div class="p-3 border-t border-zed-border-subtle">
              <button
                class="w-full py-2 px-3 text-xs text-zed-text-secondary hover:text-zed-text-primary bg-zed-bg-surface hover:bg-zed-bg-hover border border-zed-border-subtle rounded transition-colors"
                onClick={handleLoadMore}
              >
                Show More Files ({displayInfo().totalFiles - displayInfo().displayedFiles} more)
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

interface FileResultGroupProps {
  fileResult: FileSearchResults;
  workingDir: string;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  matchWord: boolean;
  laneId: string;
  showAllMatches: boolean; // If true, show all matches; if false, show preview
  onToggle: () => void;
  onMatchClick: (match: SearchMatch) => void;
}

function FileResultGroup(props: FileResultGroupProps) {

  const relativePath = () => {
    const fullPath = props.fileResult.filePath;
    if (fullPath.startsWith(props.workingDir)) {
      return fullPath.slice(props.workingDir.length + 1);
    }
    return fullPath;
  };

  // Determine which matches to display
  // Show all if: showAllMatches flag is set (results not truncated), or few matches
  const displayedMatches = () => {
    const all = props.fileResult.matches;
    if (props.showAllMatches || all.length <= MATCHES_PER_FILE_PREVIEW) {
      return all;
    }
    return all.slice(0, MATCHES_PER_FILE_PREVIEW);
  };

  const hiddenCount = () => {
    const all = props.fileResult.matches;
    if (props.showAllMatches || all.length <= MATCHES_PER_FILE_PREVIEW) {
      return 0;
    }
    return all.length - MATCHES_PER_FILE_PREVIEW;
  };

  // Search only this file using filePaths parameter (more efficient than glob)
  const handleShowAllMatches = (e: MouseEvent) => {
    e.stopPropagation();
    // Show relative path in include pattern for user feedback
    const relPath = relativePath();
    searchStateManager.updateOptions(props.laneId, {
      includePattern: relPath
    });
    // Use filePaths for efficient single-file search
    searchStateManager.startSearch(props.laneId, props.workingDir, props.query, {
      isRegex: props.isRegex,
      caseSensitive: props.caseSensitive,
      matchWord: props.matchWord,
      filePaths: [props.fileResult.filePath],
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (['ts', 'tsx'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-accent-blue text-xs font-bold flex items-center justify-center">
          TS
        </span>
      );
    }
    if (['js', 'jsx'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-accent-yellow text-xs font-bold flex items-center justify-center">
          JS
        </span>
      );
    }
    if (['rs'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-accent-orange text-xs font-bold flex items-center justify-center">
          Rs
        </span>
      );
    }
    if (['json'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-accent-yellow text-xs font-bold flex items-center justify-center">
          {'{}'}
        </span>
      );
    }
    if (['md'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-text-secondary text-xs font-bold flex items-center justify-center">
          M
        </span>
      );
    }
    if (['css', 'scss'].includes(ext || '')) {
      return (
        <span class="w-4 h-4 text-zed-accent-purple text-xs font-bold flex items-center justify-center">
          #
        </span>
      );
    }

    return (
      <svg class="w-4 h-4 text-zed-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  return (
    <div class="border-b border-zed-border-subtle">
      {/* File Header */}
      <button
        class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-zed-bg-hover transition-colors"
        onClick={props.onToggle}
      >
        <svg
          class={`w-3 h-3 text-zed-text-tertiary transition-transform ${
            props.fileResult.isCollapsed ? '' : 'rotate-90'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        {getFileIcon(props.fileResult.fileName)}

        <span class="flex-1 text-sm text-zed-text-primary truncate">{relativePath()}</span>

        <span class="text-xs text-zed-text-tertiary px-1.5 py-0.5 bg-zed-bg-surface rounded">
          {props.fileResult.matches.length}
        </span>
      </button>

      {/* Matches */}
      <Show when={!props.fileResult.isCollapsed}>
        <div class="pb-1">
          <For each={displayedMatches()}>
            {(match) => (
              <MatchLine
                match={match}
                query={props.query}
                isRegex={props.isRegex}
                caseSensitive={props.caseSensitive}
                onClick={() => props.onMatchClick(match)}
              />
            )}
          </For>

          {/* Show more matches in this file */}
          <Show when={hiddenCount() > 0}>
            <button
              class="w-full px-3 py-1 text-xs text-zed-accent-blue hover:text-zed-accent-blue-hover hover:bg-zed-bg-hover transition-colors text-left pl-12 flex items-center gap-1"
              onClick={handleShowAllMatches}
              title="Search only this file to see all matches"
            >
              +{hiddenCount()} more <span class="text-zed-text-disabled">(search this file)</span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

interface MatchLineProps {
  match: SearchMatch;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  onClick: () => void;
}

function MatchLine(props: MatchLineProps) {
  // Highlight the match in the line content
  const highlightedContent = () => {
    const line = props.match.line_content;
    const matchText = props.match.match_text;
    const column = props.match.column;

    // Split into before, match, and after
    const before = line.slice(0, column);
    const after = line.slice(column + matchText.length);

    return { before, match: matchText, after };
  };

  return (
    <button
      class="w-full flex items-start gap-2 px-3 py-0.5 text-left hover:bg-zed-bg-hover transition-colors group"
      onClick={props.onClick}
    >
      {/* Line number */}
      <span class="w-8 text-right text-xs text-zed-text-disabled font-mono flex-shrink-0">
        {props.match.line_number}
      </span>

      {/* Line content with highlight */}
      <span class="flex-1 text-xs font-mono text-zed-text-secondary truncate">
        <span>{highlightedContent().before}</span>
        <span class="bg-zed-accent-yellow/30 text-zed-accent-yellow font-medium">
          {highlightedContent().match}
        </span>
        <span>{highlightedContent().after}</span>
      </span>
    </button>
  );
}
