//! Project-Wide File Search
//!
//! This module provides fast, gitignore-aware project search with streaming results.
//! Uses the `ignore` crate (same as ripgrep) for efficient file walking.
//!
//! # Architecture
//!
//! - `SearchState`: Manages active searches with cancel flags
//! - `search_start`: Spawns async search task, returns search ID immediately
//! - `search_cancel`: Sets cancel flag for graceful termination
//!
//! # Events
//!
//! - `search-result`: Batch of matches (50 per batch)
//!   - Payload: `{ search_id, matches: [...], files_searched }`
//! - `search-complete`: Search finished
//!   - Payload: `{ search_id, total_matches, total_files, cancelled }`
//! - `search-error`: Search error
//!   - Payload: `{ search_id, message }`

use ignore::WalkBuilder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// Maximum file size to search (1MB)
const MAX_FILE_SIZE: u64 = 1024 * 1024;

/// Number of matches to batch before emitting event
const BATCH_SIZE: usize = 50;

/// Number of context lines before/after match
const CONTEXT_LINES: usize = 2;

/// State for managing active searches
pub struct SearchState {
    searches: Mutex<HashMap<String, SearchInstance>>,
}

impl SearchState {
    pub fn new() -> Self {
        Self {
            searches: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for SearchState {
    fn default() -> Self {
        Self::new()
    }
}

/// A single search instance with cancel flag
struct SearchInstance {
    cancel_flag: Arc<AtomicBool>,
}

/// A single search match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    /// Absolute file path
    pub file_path: String,
    /// 1-indexed line number
    pub line_number: u32,
    /// 0-indexed column where match starts
    pub column: u32,
    /// Full line content (trimmed)
    pub line_content: String,
    /// The matched text
    pub match_text: String,
    /// Context lines before the match
    pub context_before: Vec<String>,
    /// Context lines after the match
    pub context_after: Vec<String>,
}

/// Payload for search result events
#[derive(Clone, Serialize, Deserialize)]
pub struct SearchResultPayload {
    pub search_id: String,
    pub matches: Vec<SearchMatch>,
    pub files_searched: u32,
}

/// Payload for search complete events
#[derive(Clone, Serialize, Deserialize)]
pub struct SearchCompletePayload {
    pub search_id: String,
    pub total_matches: u32,
    pub total_files: u32,
    pub cancelled: bool,
}

/// Payload for search error events
#[derive(Clone, Serialize, Deserialize)]
pub struct SearchErrorPayload {
    pub search_id: String,
    pub message: String,
}

/// Start a new project search
///
/// Spawns an async search task and returns the search ID immediately.
/// Results are streamed via events.
///
/// # Arguments
/// * `root_path` - Directory to search in
/// * `query` - Search query (plain text or regex)
/// * `is_regex` - Whether to treat query as regex
/// * `case_sensitive` - Whether search is case sensitive
/// * `include_pattern` - Optional glob pattern to include files (e.g., "*.ts")
/// * `exclude_pattern` - Optional glob pattern to exclude files
///
/// # Returns
/// The search ID (UUID) on success
#[tauri::command]
pub async fn search_start(
    app: AppHandle,
    state: State<'_, SearchState>,
    root_path: String,
    query: String,
    is_regex: Option<bool>,
    case_sensitive: Option<bool>,
    include_pattern: Option<String>,
    exclude_pattern: Option<String>,
) -> Result<String, String> {
    let search_id = uuid::Uuid::new_v4().to_string();
    let is_regex = is_regex.unwrap_or(false);
    let case_sensitive = case_sensitive.unwrap_or(false);

    tracing::info!(
        "Starting search '{}' in {} (regex={}, case_sensitive={})",
        query,
        root_path,
        is_regex,
        case_sensitive
    );

    // Validate root path exists
    let root = std::path::Path::new(&root_path);
    if !root.exists() {
        return Err(format!("Search path does not exist: {}", root_path));
    }

    // Create cancel flag
    let cancel_flag = Arc::new(AtomicBool::new(false));

    // Store search instance
    {
        let mut searches = state
            .searches
            .lock()
            .map_err(|e| format!("Failed to lock search state: {}", e))?;
        searches.insert(
            search_id.clone(),
            SearchInstance {
                cancel_flag: cancel_flag.clone(),
            },
        );
    }

    // Build regex pattern
    let pattern = if is_regex {
        if case_sensitive {
            Regex::new(&query)
        } else {
            Regex::new(&format!("(?i){}", query))
        }
    } else {
        // Escape special regex characters for literal search
        let escaped = regex::escape(&query);
        if case_sensitive {
            Regex::new(&escaped)
        } else {
            Regex::new(&format!("(?i){}", escaped))
        }
    };

    let pattern = pattern.map_err(|e| format!("Invalid search pattern: {}", e))?;

    // Clone values for the spawned task
    let search_id_clone = search_id.clone();
    let root_path_clone = root_path.clone();
    let app_clone = app.clone();
    let include = include_pattern.clone();
    let exclude = exclude_pattern.clone();

    // Spawn search task
    tokio::spawn(async move {
        run_search(
            app_clone,
            search_id_clone,
            root_path_clone,
            pattern,
            cancel_flag,
            include,
            exclude,
        )
        .await;
    });

    Ok(search_id)
}

/// Cancel an active search
///
/// Sets the cancel flag for the search, which will cause it to stop
/// after completing the current file.
///
/// # Arguments
/// * `search_id` - The search ID to cancel
#[tauri::command]
pub async fn search_cancel(
    state: State<'_, SearchState>,
    search_id: String,
) -> Result<(), String> {
    let searches = state
        .searches
        .lock()
        .map_err(|e| format!("Failed to lock search state: {}", e))?;

    if let Some(instance) = searches.get(&search_id) {
        instance.cancel_flag.store(true, Ordering::SeqCst);
        tracing::info!("Search {} cancelled", search_id);
        Ok(())
    } else {
        Err(format!("Search not found: {}", search_id))
    }
}

/// Run the actual search (called in spawned task)
async fn run_search(
    app: AppHandle,
    search_id: String,
    root_path: String,
    pattern: Regex,
    cancel_flag: Arc<AtomicBool>,
    include_pattern: Option<String>,
    exclude_pattern: Option<String>,
) {
    let mut matches_batch: Vec<SearchMatch> = Vec::with_capacity(BATCH_SIZE);
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;

    // Build the file walker with gitignore support
    let mut walker = WalkBuilder::new(&root_path);
    walker
        .hidden(false) // Don't skip hidden files by default
        .ignore(true) // Respect .gitignore
        .git_ignore(true) // Respect .gitignore
        .git_global(true) // Respect global .gitignore
        .git_exclude(true) // Respect .git/info/exclude
        .follow_links(false) // Don't follow symlinks
        .parents(true); // Check parent directories for .gitignore

    // Add custom include/exclude patterns
    if let Some(ref include) = include_pattern {
        // For include patterns, we need to add a custom glob
        let mut override_builder = ignore::overrides::OverrideBuilder::new(&root_path);
        if let Err(e) = override_builder.add(include) {
            tracing::warn!("Invalid include pattern '{}': {}", include, e);
        }
        if let Ok(overrides) = override_builder.build() {
            walker.overrides(overrides);
        }
    }

    if let Some(ref exclude) = exclude_pattern {
        // For exclude patterns, prefix with ! to negate
        let mut override_builder = ignore::overrides::OverrideBuilder::new(&root_path);
        if let Err(e) = override_builder.add(&format!("!{}", exclude)) {
            tracing::warn!("Invalid exclude pattern '{}': {}", exclude, e);
        }
        if let Ok(overrides) = override_builder.build() {
            walker.overrides(overrides);
        }
    }

    let walker = walker.build();

    for entry in walker {
        // Check cancel flag
        if cancel_flag.load(Ordering::SeqCst) {
            tracing::info!("Search {} cancelled by user", search_id);
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                tracing::debug!("Error walking entry: {}", e);
                continue;
            }
        };

        // Skip directories
        let file_type = match entry.file_type() {
            Some(ft) => ft,
            None => continue,
        };

        if !file_type.is_file() {
            continue;
        }

        let path = entry.path();

        // Check file size
        if let Ok(metadata) = path.metadata() {
            if metadata.len() > MAX_FILE_SIZE {
                tracing::debug!("Skipping large file: {:?}", path);
                continue;
            }
        }

        // Search the file
        if let Some(file_matches) = search_file(path, &pattern) {
            for m in file_matches {
                matches_batch.push(m);
                total_matches += 1;

                // Emit batch when full
                if matches_batch.len() >= BATCH_SIZE {
                    let _ = app.emit(
                        "search-result",
                        SearchResultPayload {
                            search_id: search_id.clone(),
                            matches: matches_batch.clone(),
                            files_searched,
                        },
                    );
                    matches_batch.clear();
                }
            }
        }

        files_searched += 1;
    }

    // Emit remaining matches
    if !matches_batch.is_empty() {
        let _ = app.emit(
            "search-result",
            SearchResultPayload {
                search_id: search_id.clone(),
                matches: matches_batch,
                files_searched,
            },
        );
    }

    // Emit completion event
    let cancelled = cancel_flag.load(Ordering::SeqCst);
    let _ = app.emit(
        "search-complete",
        SearchCompletePayload {
            search_id: search_id.clone(),
            total_matches,
            total_files: files_searched,
            cancelled,
        },
    );

    tracing::info!(
        "Search {} complete: {} matches in {} files (cancelled={})",
        search_id,
        total_matches,
        files_searched,
        cancelled
    );
}

/// Search a single file for matches
fn search_file(path: &std::path::Path, pattern: &Regex) -> Option<Vec<SearchMatch>> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();

    if lines.is_empty() {
        return None;
    }

    let mut matches = Vec::new();
    let path_str = path.to_string_lossy().to_string();

    for (line_idx, line) in lines.iter().enumerate() {
        // Find all matches in the line
        for mat in pattern.find_iter(line) {
            // Get context lines
            let context_before: Vec<String> = lines
                .iter()
                .skip(line_idx.saturating_sub(CONTEXT_LINES))
                .take(line_idx.saturating_sub(line_idx.saturating_sub(CONTEXT_LINES)))
                .cloned()
                .collect();

            let context_after: Vec<String> = lines
                .iter()
                .skip(line_idx + 1)
                .take(CONTEXT_LINES)
                .cloned()
                .collect();

            matches.push(SearchMatch {
                file_path: path_str.clone(),
                line_number: (line_idx + 1) as u32,
                column: mat.start() as u32,
                line_content: line.clone(),
                match_text: mat.as_str().to_string(),
                context_before,
                context_after,
            });
        }
    }

    if matches.is_empty() {
        None
    } else {
        Some(matches)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_state_creation() {
        let state = SearchState::new();
        let searches = state.searches.lock().unwrap();
        assert!(searches.is_empty());
    }

    #[test]
    fn test_search_match_serialization() {
        let m = SearchMatch {
            file_path: "/test/file.rs".to_string(),
            line_number: 42,
            column: 10,
            line_content: "let x = foo;".to_string(),
            match_text: "foo".to_string(),
            context_before: vec!["// comment".to_string()],
            context_after: vec!["let y = bar;".to_string()],
        };

        let json = serde_json::to_string(&m).unwrap();
        assert!(json.contains("file.rs"));
        assert!(json.contains("42"));
    }

    #[test]
    fn test_literal_pattern_escaping() {
        let query = "foo.bar()";
        let escaped = regex::escape(query);
        let pattern = Regex::new(&escaped).unwrap();

        assert!(pattern.is_match("foo.bar()"));
        assert!(!pattern.is_match("fooXbar()"));
    }

    #[test]
    fn test_case_insensitive_search() {
        let query = "(?i)hello";
        let pattern = Regex::new(query).unwrap();

        assert!(pattern.is_match("Hello"));
        assert!(pattern.is_match("HELLO"));
        assert!(pattern.is_match("hello"));
    }
}
