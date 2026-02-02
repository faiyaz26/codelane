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
}

/** Search options */
export interface SearchOptions {
  isRegex?: boolean;
  caseSensitive?: boolean;
  includePattern?: string;
  excludePattern?: string;
}

/** Search state for a single lane */
interface LaneSearchState {
  searchId: string | null;
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  isSearching: boolean;
  results: Map<string, FileSearchResults>;
  totalMatches: number;
  totalFiles: number;
  error: string | null;
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
        query: '',
        isRegex: false,
        caseSensitive: false,
        isSearching: false,
        results: new Map(),
        totalMatches: 0,
        totalFiles: 0,
        error: null,
      };
      this.laneStates.set(laneId, state);
    }
    return state;
  }

  // Find lane by search ID
  private findLaneBySearchId(searchId: string): string | null {
    for (const [laneId, state] of this.laneStates.entries()) {
      if (state.searchId === searchId) {
        return laneId;
      }
    }
    return null;
  }

  // Handle incoming search results
  private handleSearchResult(payload: SearchResultPayload) {
    const laneId = this.findLaneBySearchId(payload.search_id);
    if (!laneId) return;

    const state = this.laneStates.get(laneId);
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
          matches: [],
          isCollapsed: false,
        };
        state.results.set(filePath, fileResults);
      }

      fileResults.matches.push(match);
    }

    state.totalMatches += payload.matches.length;
    state.totalFiles = payload.files_searched;

    this.triggerUpdate();
  }

  // Handle search complete
  private handleSearchComplete(payload: SearchCompletePayload) {
    const laneId = this.findLaneBySearchId(payload.search_id);
    if (!laneId) return;

    const state = this.laneStates.get(laneId);
    if (!state) return;

    state.isSearching = false;
    state.totalMatches = payload.total_matches;
    state.totalFiles = payload.total_files;

    console.log(
      `[SearchStateManager] Search complete: ${payload.total_matches} matches in ${payload.total_files} files`
    );

    this.triggerUpdate();
  }

  // Handle search error
  private handleSearchError(payload: SearchErrorPayload) {
    const laneId = this.findLaneBySearchId(payload.search_id);
    if (!laneId) return;

    const state = this.laneStates.get(laneId);
    if (!state) return;

    state.isSearching = false;
    state.error = payload.message;

    console.error('[SearchStateManager] Search error:', payload.message);

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
    state.isRegex = options.isRegex ?? false;
    state.caseSensitive = options.caseSensitive ?? false;
    state.isSearching = true;

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

  // Get search results for a lane
  getResults(laneId: string): FileSearchResults[] {
    // Access trigger for reactivity
    this.updateTrigger[0]();

    const state = this.laneStates.get(laneId);
    if (!state) return [];

    // Convert map to array, sorted by file path
    return Array.from(state.results.values()).sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    );
  }

  // Get search state for a lane
  getSearchState(laneId: string): {
    query: string;
    isRegex: boolean;
    caseSensitive: boolean;
    isSearching: boolean;
    totalMatches: number;
    totalFiles: number;
    error: string | null;
  } {
    // Access trigger for reactivity
    this.updateTrigger[0]();

    const state = this.laneStates.get(laneId);
    if (!state) {
      return {
        query: '',
        isRegex: false,
        caseSensitive: false,
        isSearching: false,
        totalMatches: 0,
        totalFiles: 0,
        error: null,
      };
    }

    return {
      query: state.query,
      isRegex: state.isRegex,
      caseSensitive: state.caseSensitive,
      isSearching: state.isSearching,
      totalMatches: state.totalMatches,
      totalFiles: state.totalFiles,
      error: state.error,
    };
  }

  // Toggle file collapse state
  toggleFileCollapse(laneId: string, filePath: string): void {
    const state = this.laneStates.get(laneId);
    if (!state) return;

    const fileResults = state.results.get(filePath);
    if (fileResults) {
      fileResults.isCollapsed = !fileResults.isCollapsed;
      this.triggerUpdate();
    }
  }

  // Clear search results for a lane
  clearResults(laneId: string): void {
    const state = this.laneStates.get(laneId);
    if (state) {
      state.searchId = null;
      state.query = '';
      state.results.clear();
      state.totalMatches = 0;
      state.totalFiles = 0;
      state.error = null;
      state.isSearching = false;
      this.triggerUpdate();
    }
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
