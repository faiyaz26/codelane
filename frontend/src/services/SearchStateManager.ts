// Search State Manager - manages search state per lane

import { createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** A single search match from the backend */
export interface SearchMatch {
  file_path: string;
  line_number: number;
  column: number;
  line_content: string;
  match_text: string;
  context_before: string[];
  context_after: string[];
}

/** Search results grouped by file */
export interface FileSearchResults {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
  isCollapsed: boolean;
  /** Whether all matches are shown or just preview */
  isExpanded: boolean;
}

/** Search options */
export interface SearchOptions {
  isRegex?: boolean;
  caseSensitive?: boolean;
  includePattern?: string;
  excludePattern?: string;
  /** Specific files or directories to search (absolute paths) */
  filePaths?: string[];
  /** Maximum matches to return (0 = unlimited, default: 1000) */
  maxMatches?: number;
}

/** Initial display limit for files */
const INITIAL_FILE_LIMIT = 20;
/** How many more files to load on "Load More" */
const LOAD_MORE_FILES = 20;
/** How many matches to show per file initially */
export const MATCHES_PER_FILE_PREVIEW = 3;

/** Search state for a single lane */
interface LaneSearchState {
  searchId: string | null;
  /** Additional search IDs for file-specific sub-searches */
  subSearchIds: Set<string>;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  includePattern: string;
  excludePattern: string;
  isSearching: boolean;
  results: Map<string, FileSearchResults>;
  totalMatches: number;
  totalFiles: number;
  error: string | null;
  /** Current file display limit for pagination */
  fileLimit: number;
  /** Whether results were truncated by backend limit */
  truncated: boolean;
}

/** Payload for search result events */
interface SearchResultPayload {
  search_id: string;
  matches: SearchMatch[];
  files_searched: number;
}

/** Payload for search complete events */
interface SearchCompletePayload {
  search_id: string;
  total_matches: number;
  total_files: number;
  cancelled: boolean;
  truncated: boolean;
}

/** Payload for search error events */
interface SearchErrorPayload {
  search_id: string;
  message: string;
}

class SearchStateManager {
  // State per lane
  private laneStates = new Map<string, LaneSearchState>();

  // Event listeners (global, filter by search_id)
  private resultUnlisten: UnlistenFn | null = null;
  private completeUnlisten: UnlistenFn | null = null;
  private errorUnlisten: UnlistenFn | null = null;
  private listenersInitialized = false;

  // Reactive signal for UI updates
  private updateTrigger = createSignal(0);

  constructor() {
    // Initialize event listeners
    this.initEventListeners();
  }

  // Initialize Tauri event listeners
  private async initEventListeners() {
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    try {
      // Listen for search results
      this.resultUnlisten = await listen<SearchResultPayload>('search-result', (event) => {
        this.handleSearchResult(event.payload);
      });

      // Listen for search complete
      this.completeUnlisten = await listen<SearchCompletePayload>('search-complete', (event) => {
        this.handleSearchComplete(event.payload);
      });

      // Listen for search errors
      this.errorUnlisten = await listen<SearchErrorPayload>('search-error', (event) => {
        this.handleSearchError(event.payload);
      });

      console.log('[SearchStateManager] Event listeners initialized');
    } catch (error) {
      console.error('[SearchStateManager] Failed to initialize event listeners:', error);
    }
  }

  // Trigger reactive update - deferred to avoid conflicts with reactive disposal
  private triggerUpdate() {
    // Use queueMicrotask to defer signal writes, avoiding conflicts
    // with SolidJS's reactive disposal cycle during component unmounts
    queueMicrotask(() => {
      try {
        const [, setTrigger] = this.updateTrigger;
        setTrigger((v) => v + 1);
      } catch (e) {
        // Ignore errors from disposed reactive contexts
        console.debug('[SearchStateManager] Update skipped (context disposed)');
      }
    });
  }

  // Get update signal (for reactivity)
  getUpdateSignal() {
    return this.updateTrigger[0];
  }

  // Get or create state for a lane
  private getOrCreateLaneState(laneId: string): LaneSearchState {
    let state = this.laneStates.get(laneId);
    if (!state) {
      state = {
        searchId: null,
        subSearchIds: new Set(),
        query: '',
        isRegex: false,
        caseSensitive: false,
        includePattern: '',
        excludePattern: '',
        isSearching: false,
        results: new Map(),
        totalMatches: 0,
        totalFiles: 0,
        error: null,
        fileLimit: INITIAL_FILE_LIMIT,
        truncated: false,
      };
      this.laneStates.set(laneId, state);
    }
    return state;
  }

  // Find lane by search ID (checks main search and sub-searches)
  private findLaneBySearchId(searchId: string): { laneId: string; isSubSearch: boolean } | null {
    for (const [laneId, state] of this.laneStates.entries()) {
      if (state.searchId === searchId) {
        return { laneId, isSubSearch: false };
      }
      if (state.subSearchIds.has(searchId)) {
        return { laneId, isSubSearch: true };
      }
    }
    return null;
  }

  // Handle incoming search results
  private handleSearchResult(payload: SearchResultPayload) {
    const result = this.findLaneBySearchId(payload.search_id);
    if (!result) return;

    const state = this.laneStates.get(result.laneId);
    if (!state) return;

    // Group matches by file
    for (const match of payload.matches) {
      const filePath = match.file_path;
      let fileResults = state.results.get(filePath);

      if (!fileResults) {
        // Extract file name from path
        const fileName = filePath.split('/').pop() || filePath;
        fileResults = {
          filePath,
          fileName,
          matches: [match], // Start with this match
          isCollapsed: false,
          isExpanded: result.isSubSearch, // Auto-expand for file-specific searches
        };
        state.results.set(filePath, fileResults);
      } else {
        // Create new object with new matches array to ensure reactivity
        const newFileResults: FileSearchResults = {
          ...fileResults,
          matches: [...fileResults.matches, match]
        };
        state.results.set(filePath, newFileResults);
      }
    }

    // Only update totals for main search, not sub-searches
    if (!result.isSubSearch) {
      state.totalMatches += payload.matches.length;
      state.totalFiles = payload.files_searched;
    }

    this.triggerUpdate();
  }

  // Handle search complete
  private handleSearchComplete(payload: SearchCompletePayload) {
    const result = this.findLaneBySearchId(payload.search_id);
    if (!result) return;

    const state = this.laneStates.get(result.laneId);
    if (!state) return;

    if (result.isSubSearch) {
      // Remove completed sub-search from tracking
      state.subSearchIds.delete(payload.search_id);
      console.log(
        `[SearchStateManager] File-specific search complete: ${payload.total_matches} matches`
      );
    } else {
      // Main search complete
      state.isSearching = false;
      state.totalMatches = payload.total_matches;
      state.totalFiles = payload.total_files;
      state.truncated = payload.truncated;

      console.log(
        `[SearchStateManager] Search complete: ${payload.total_matches} matches in ${payload.total_files} files (truncated=${payload.truncated})`
      );
    }

    this.triggerUpdate();
  }

  // Handle search error
  private handleSearchError(payload: SearchErrorPayload) {
    const result = this.findLaneBySearchId(payload.search_id);
    if (!result) return;

    const state = this.laneStates.get(result.laneId);
    if (!state) return;

    if (result.isSubSearch) {
      // Remove failed sub-search from tracking
      state.subSearchIds.delete(payload.search_id);
      console.error('[SearchStateManager] File-specific search error:', payload.message);
    } else {
      state.isSearching = false;
      state.error = payload.message;
      console.error('[SearchStateManager] Search error:', payload.message);
    }

    this.triggerUpdate();
  }

  // Start a new search
  async startSearch(
    laneId: string,
    rootPath: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<void> {
    if (!query.trim()) {
      this.clearResults(laneId);
      return;
    }

    const state = this.getOrCreateLaneState(laneId);

    // Cancel any existing search
    if (state.searchId && state.isSearching) {
      await this.cancelSearch(laneId);
    }

    // Clear previous results
    state.results.clear();
    state.totalMatches = 0;
    state.totalFiles = 0;
    state.error = null;
    state.query = query;
    state.isRegex = options.isRegex ?? state.isRegex;
    state.caseSensitive = options.caseSensitive ?? state.caseSensitive;
    state.includePattern = options.includePattern ?? state.includePattern;
    state.excludePattern = options.excludePattern ?? state.excludePattern;
    state.isSearching = true;
    state.fileLimit = INITIAL_FILE_LIMIT;
    state.truncated = false;

    this.triggerUpdate();

    try {
      // Start the search via Tauri command
      const searchId = await invoke<string>('search_start', {
        rootPath,
        query,
        isRegex: options.isRegex ?? false,
        caseSensitive: options.caseSensitive ?? false,
        includePattern: options.includePattern,
        excludePattern: options.excludePattern,
        maxMatches: options.maxMatches,
        filePaths: options.filePaths,
      });

      state.searchId = searchId;
      console.log(`[SearchStateManager] Search started: ${searchId}`);
    } catch (error) {
      state.isSearching = false;
      state.error = error instanceof Error ? error.message : 'Search failed';
      console.error('[SearchStateManager] Failed to start search:', error);
    }

    this.triggerUpdate();
  }

  // Cancel an active search
  async cancelSearch(laneId: string): Promise<void> {
    const state = this.laneStates.get(laneId);
    if (!state || !state.searchId) return;

    try {
      await invoke('search_cancel', { searchId: state.searchId });
      state.isSearching = false;
      console.log(`[SearchStateManager] Search cancelled: ${state.searchId}`);
    } catch (error) {
      console.error('[SearchStateManager] Failed to cancel search:', error);
    }

    this.triggerUpdate();
  }

  // Get search results for a lane (paginated by files)
  getResults(laneId: string): FileSearchResults[] {
    // Access trigger for reactivity
    this.updateTrigger[0]();

    const state = this.laneStates.get(laneId);
    if (!state) return [];

    // Convert map to array, sorted by number of matches (most matches first)
    const allResults = Array.from(state.results.values()).sort((a, b) =>
      b.matches.length - a.matches.length
    );

    // Apply file limit
    return allResults.slice(0, state.fileLimit);
  }

  // Get display info for pagination (file-based)
  getDisplayInfo(laneId: string): {
    displayedFiles: number;
    totalFiles: number;
    totalMatches: number;
    hasMore: boolean;
  } {
    // Access trigger for reactivity
    this.updateTrigger[0]();

    const state = this.laneStates.get(laneId);
    if (!state) return { displayedFiles: 0, totalFiles: 0, totalMatches: 0, hasMore: false };

    const totalFiles = state.results.size;
    const displayedFiles = Math.min(state.fileLimit, totalFiles);
    return {
      displayedFiles,
      totalFiles,
      totalMatches: state.totalMatches,
      hasMore: totalFiles > state.fileLimit,
    };
  }

  // Load more files
  loadMore(laneId: string): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    state.fileLimit += LOAD_MORE_FILES;
    this.triggerUpdate();
  }

  // Toggle expanded state for a file (show all matches vs preview)
  toggleFileExpanded(laneId: string, filePath: string): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const fileResults = state.results.get(filePath);
    if (fileResults) {
      // Create a new object to ensure reactivity
      const newFileResults: FileSearchResults = {
        ...fileResults,
        isExpanded: !fileResults.isExpanded
      };
      state.results.set(filePath, newFileResults);
      this.triggerUpdate();
    }
  }

  // Search within specific files only (useful for loading all matches in a file)
  // Results are merged with existing results for those files
  async searchInFiles(
    laneId: string,
    rootPath: string,
    query: string,
    filePaths: string[],
    options: Omit<SearchOptions, 'filePaths' | 'maxMatches'> = {}
  ): Promise<void> {
    if (!query.trim() || filePaths.length === 0) return;

    const state = this.getOrCreateLaneState(laneId);

    // Mark files as loading by clearing old matches
    for (const filePath of filePaths) {
      const fileResult = state.results.get(filePath);
      if (fileResult) {
        // Create new object with cleared matches and expanded state
        const newFileResult: FileSearchResults = {
          ...fileResult,
          matches: [],
          isExpanded: true
        };
        state.results.set(filePath, newFileResult);
      }
    }
    this.triggerUpdate();

    try {
      // Search with no limit for specific files
      const searchId = await invoke<string>('search_start', {
        rootPath,
        query,
        isRegex: options.isRegex ?? state.isRegex,
        caseSensitive: options.caseSensitive ?? state.caseSensitive,
        includePattern: options.includePattern,
        excludePattern: options.excludePattern,
        maxMatches: 0, // No limit for targeted search
        filePaths,
      });

      // Track as sub-search so event handlers can route results correctly
      state.subSearchIds.add(searchId);
      console.log(`[SearchStateManager] Started file-specific search: ${searchId} for ${filePaths.length} files`);
    } catch (error) {
      console.error('[SearchStateManager] Failed to search in files:', error);
    }
  }

  // Get search state for a lane
  getSearchState(laneId: string): {
    query: string;
    isRegex: boolean;
    caseSensitive: boolean;
    includePattern: string;
    excludePattern: string;
    isSearching: boolean;
    totalMatches: number;
    totalFiles: number;
    error: string | null;
    truncated: boolean;
  } {
    // Access trigger for reactivity
    this.updateTrigger[0]();

    const state = this.laneStates.get(laneId);
    if (!state) {
      return {
        query: '',
        isRegex: false,
        caseSensitive: false,
        includePattern: '',
        excludePattern: '',
        isSearching: false,
        totalMatches: 0,
        totalFiles: 0,
        error: null,
        truncated: false,
      };
    }

    return {
      query: state.query,
      isRegex: state.isRegex,
      caseSensitive: state.caseSensitive,
      includePattern: state.includePattern,
      excludePattern: state.excludePattern,
      isSearching: state.isSearching,
      totalMatches: state.totalMatches,
      totalFiles: state.totalFiles,
      error: state.error,
      truncated: state.truncated,
    };
  }

  // Toggle file collapse state
  toggleFileCollapse(laneId: string, filePath: string): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const fileResults = state.results.get(filePath);
    if (fileResults) {
      // Create a new object to ensure reactivity
      const newFileResults: FileSearchResults = {
        ...fileResults,
        isCollapsed: !fileResults.isCollapsed
      };
      state.results.set(filePath, newFileResults);
      this.triggerUpdate();
    }
  }

  // Clear search results for a lane
  clearResults(laneId: string): void {
    const state = this.laneStates.get(laneId);
    if (state) {
      state.searchId = null;
      state.subSearchIds.clear();
      state.query = '';
      state.results.clear();
      state.totalMatches = 0;
      state.totalFiles = 0;
      state.error = null;
      state.isSearching = false;
      state.fileLimit = INITIAL_FILE_LIMIT;
      state.truncated = false;
      this.triggerUpdate();
    }
  }

  // Update query without triggering search (for controlled input)
  updateQuery(laneId: string, query: string): void {
    const state = this.getOrCreateLaneState(laneId);
    state.query = query;
    this.triggerUpdate();
  }

  // Update search options without triggering search
  updateOptions(laneId: string, options: { isRegex?: boolean; caseSensitive?: boolean; includePattern?: string; excludePattern?: string }): void {
    const state = this.getOrCreateLaneState(laneId);
    if (options.isRegex !== undefined) {
      state.isRegex = options.isRegex;
    }
    if (options.caseSensitive !== undefined) {
      state.caseSensitive = options.caseSensitive;
    }
    if (options.includePattern !== undefined) {
      state.includePattern = options.includePattern;
    }
    if (options.excludePattern !== undefined) {
      state.excludePattern = options.excludePattern;
    }
    this.triggerUpdate();
  }

  // Dispose lane state
  disposeLane(laneId: string): void {
    const state = this.laneStates.get(laneId);
    if (state && state.searchId && state.isSearching) {
      // Cancel any active search
      invoke('search_cancel', { searchId: state.searchId }).catch(() => {});
    }
    this.laneStates.delete(laneId);
    this.triggerUpdate();
  }

  // Cleanup all listeners
  dispose(): void {
    if (this.resultUnlisten) {
      this.resultUnlisten();
      this.resultUnlisten = null;
    }
    if (this.completeUnlisten) {
      this.completeUnlisten();
      this.completeUnlisten = null;
    }
    if (this.errorUnlisten) {
      this.errorUnlisten();
      this.errorUnlisten = null;
    }
    this.laneStates.clear();
    this.listenersInitialized = false;
  }
}

// Singleton instance
export const searchStateManager = new SearchStateManager();
