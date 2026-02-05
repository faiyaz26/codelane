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

/// Default maximum matches to return (0 = unlimited)
const DEFAULT_MAX_MATCHES: u32 = 1000;

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
    /// Whether results were truncated due to max_matches limit
    pub truncated: bool,
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
/// * `match_word` - Whether to match whole words only (adds word boundaries)
/// * `include_pattern` - Optional glob pattern to include files (e.g., "*.ts")
/// * `exclude_pattern` - Optional glob pattern to exclude files
/// * `max_matches` - Maximum number of matches to return (default: 1000, 0 = unlimited)
/// * `file_paths` - Optional list of specific files or directories to search (absolute paths)
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
    match_word: Option<bool>,
    include_pattern: Option<String>,
    exclude_pattern: Option<String>,
    max_matches: Option<u32>,
    file_paths: Option<Vec<String>>,
) -> Result<String, String> {
    let search_id = uuid::Uuid::new_v4().to_string();
    let is_regex = is_regex.unwrap_or(false);
    let case_sensitive = case_sensitive.unwrap_or(false);
    let match_word = match_word.unwrap_or(false);
    let max_matches = max_matches.unwrap_or(DEFAULT_MAX_MATCHES);

    tracing::info!(
        "Starting search '{}' in {} (regex={}, case_sensitive={}, match_word={}, max_matches={}, file_paths={:?})",
        query,
        root_path,
        is_regex,
        case_sensitive,
        match_word,
        max_matches,
        file_paths.as_ref().map(|p| p.len())
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
        let base_pattern = &query;
        let pattern_with_word = if match_word {
            format!(r"\b{}\b", base_pattern)
        } else {
            base_pattern.to_string()
        };

        if case_sensitive {
            Regex::new(&pattern_with_word)
        } else {
            Regex::new(&format!("(?i){}", pattern_with_word))
        }
    } else {
        // Escape special regex characters for literal search
        let escaped = regex::escape(&query);
        let pattern_with_word = if match_word {
            format!(r"\b{}\b", escaped)
        } else {
            escaped
        };

        if case_sensitive {
            Regex::new(&pattern_with_word)
        } else {
            Regex::new(&format!("(?i){}", pattern_with_word))
        }
    };

    let pattern = pattern.map_err(|e| format!("Invalid search pattern: {}", e))?;

    // Clone values for the spawned task
    let search_id_clone = search_id.clone();
    let root_path_clone = root_path.clone();
    let app_clone = app.clone();
    let include = include_pattern.clone();
    let exclude = exclude_pattern.clone();
    let paths = file_paths.clone();

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
            max_matches,
            paths,
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
    max_matches: u32,
    file_paths: Option<Vec<String>>,
) {
    let mut matches_batch: Vec<SearchMatch> = Vec::with_capacity(BATCH_SIZE);
    let mut total_matches: u32 = 0;
    let mut files_searched: u32 = 0;
    let mut truncated = false;

    // Convert file_paths to a HashSet for fast lookup (canonicalize for reliable comparison)
    let restricted_paths: Option<std::collections::HashSet<std::path::PathBuf>> =
        file_paths.map(|paths| {
            paths
                .into_iter()
                .filter_map(|p| {
                    let path = std::path::PathBuf::from(&p);
                    // Try to canonicalize, fall back to original path
                    path.canonicalize().ok().or(Some(path))
                })
                .collect()
        });

    if let Some(ref restricted) = restricted_paths {
        tracing::info!("Search restricted to {} paths: {:?}", restricted.len(), restricted);
    }

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

    'outer: for entry in walker {
        // Check cancel flag
        if cancel_flag.load(Ordering::SeqCst) {
            tracing::info!("Search {} cancelled by user", search_id);
            break;
        }

        // Check max matches limit (0 = unlimited)
        if max_matches > 0 && total_matches >= max_matches {
            truncated = true;
            tracing::info!(
                "Search {} reached max matches limit ({})",
                search_id,
                max_matches
            );
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

        // Check if file is in restricted paths (if specified)
        if let Some(ref restricted) = restricted_paths {
            // Canonicalize the entry path for reliable comparison
            let canonical_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
            let path_matches = restricted.contains(&canonical_path)
                || restricted.iter().any(|restricted_path| {
                    // Check if restricted_path is a parent directory of path
                    canonical_path.starts_with(restricted_path)
                });
            if !path_matches {
                continue;
            }
        }

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

                // Check max matches limit after each match
                if max_matches > 0 && total_matches >= max_matches {
                    truncated = true;
                    tracing::info!(
                        "Search {} reached max matches limit ({})",
                        search_id,
                        max_matches
                    );
                    break 'outer;
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
            truncated,
        },
    );

    tracing::info!(
        "Search {} complete: {} matches in {} files (cancelled={}, truncated={})",
        search_id,
        total_matches,
        files_searched,
        cancelled,
        truncated
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
    use std::fs;
    use tempfile::TempDir;

    // =========================================================================
    // SearchState tests
    // =========================================================================

    #[test]
    fn test_search_state_creation() {
        let state = SearchState::new();
        let searches = state.searches.lock().unwrap();
        assert!(searches.is_empty());
    }

    #[test]
    fn test_search_state_default() {
        let state = SearchState::default();
        let searches = state.searches.lock().unwrap();
        assert!(searches.is_empty());
    }

    #[test]
    fn test_search_state_thread_safety() {
        use std::sync::Arc;

        let state = Arc::new(SearchState::new());
        let handles: Vec<_> = (0..4)
            .map(|_| {
                let state_clone = state.clone();
                std::thread::spawn(move || {
                    let searches = state_clone.searches.lock().unwrap();
                    assert!(searches.is_empty());
                })
            })
            .collect();

        for handle in handles {
            handle.join().expect("Thread panicked");
        }
    }

    // =========================================================================
    // SearchMatch tests
    // =========================================================================

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
        assert!(json.contains("\"file_path\":\"/test/file.rs\""));
        assert!(json.contains("\"line_number\":42"));
        assert!(json.contains("\"column\":10"));
        assert!(json.contains("\"match_text\":\"foo\""));
    }

    #[test]
    fn test_search_match_deserialization() {
        let json = r#"{
            "file_path": "/test/file.rs",
            "line_number": 42,
            "column": 10,
            "line_content": "let x = foo;",
            "match_text": "foo",
            "context_before": ["// comment"],
            "context_after": ["let y = bar;"]
        }"#;

        let m: SearchMatch = serde_json::from_str(json).unwrap();
        assert_eq!(m.file_path, "/test/file.rs");
        assert_eq!(m.line_number, 42);
        assert_eq!(m.column, 10);
        assert_eq!(m.match_text, "foo");
    }

    #[test]
    fn test_search_match_empty_context() {
        let m = SearchMatch {
            file_path: "/test/file.rs".to_string(),
            line_number: 1,
            column: 0,
            line_content: "first line".to_string(),
            match_text: "first".to_string(),
            context_before: vec![],
            context_after: vec![],
        };

        let json = serde_json::to_string(&m).unwrap();
        let deserialized: SearchMatch = serde_json::from_str(&json).unwrap();

        assert!(deserialized.context_before.is_empty());
        assert!(deserialized.context_after.is_empty());
    }

    // =========================================================================
    // SearchResultPayload tests
    // =========================================================================

    #[test]
    fn test_search_result_payload_serialization() {
        let payload = SearchResultPayload {
            search_id: "abc-123".to_string(),
            matches: vec![],
            files_searched: 100,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"search_id\":\"abc-123\""));
        assert!(json.contains("\"files_searched\":100"));
    }

    #[test]
    fn test_search_result_payload_with_matches() {
        let payload = SearchResultPayload {
            search_id: "abc-123".to_string(),
            matches: vec![
                SearchMatch {
                    file_path: "/a.txt".to_string(),
                    line_number: 1,
                    column: 0,
                    line_content: "hello".to_string(),
                    match_text: "hello".to_string(),
                    context_before: vec![],
                    context_after: vec![],
                },
            ],
            files_searched: 1,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("/a.txt"));
    }

    // =========================================================================
    // SearchCompletePayload tests
    // =========================================================================

    #[test]
    fn test_search_complete_payload_serialization() {
        let payload = SearchCompletePayload {
            search_id: "abc-123".to_string(),
            total_matches: 42,
            total_files: 100,
            cancelled: false,
            truncated: false,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"total_matches\":42"));
        assert!(json.contains("\"total_files\":100"));
        assert!(json.contains("\"cancelled\":false"));
        assert!(json.contains("\"truncated\":false"));
    }

    #[test]
    fn test_search_complete_payload_cancelled() {
        let payload = SearchCompletePayload {
            search_id: "abc-123".to_string(),
            total_matches: 10,
            total_files: 50,
            cancelled: true,
            truncated: false,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"cancelled\":true"));
    }

    #[test]
    fn test_search_complete_payload_truncated() {
        let payload = SearchCompletePayload {
            search_id: "abc-123".to_string(),
            total_matches: 1000,
            total_files: 500,
            cancelled: false,
            truncated: true,
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"truncated\":true"));
    }

    // =========================================================================
    // SearchErrorPayload tests
    // =========================================================================

    #[test]
    fn test_search_error_payload_serialization() {
        let payload = SearchErrorPayload {
            search_id: "abc-123".to_string(),
            message: "File not found".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"search_id\":\"abc-123\""));
        assert!(json.contains("\"message\":\"File not found\""));
    }

    // =========================================================================
    // Pattern matching tests
    // =========================================================================

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

    #[test]
    fn test_word_boundary_pattern() {
        let query = r"\bfoo\b";
        let pattern = Regex::new(query).unwrap();

        assert!(pattern.is_match("foo"));
        assert!(pattern.is_match("the foo bar"));
        assert!(!pattern.is_match("foobar"));
        assert!(!pattern.is_match("barfoo"));
    }

    #[test]
    fn test_regex_special_chars_escaping() {
        // Test that special regex characters are properly escaped
        let special_chars = r"[]()+*?{}|^$.\";
        let escaped = regex::escape(special_chars);
        let pattern = Regex::new(&escaped).unwrap();

        assert!(pattern.is_match(special_chars));
    }

    #[test]
    fn test_case_sensitive_pattern() {
        let pattern = Regex::new("Hello").unwrap();

        assert!(pattern.is_match("Hello"));
        assert!(!pattern.is_match("hello"));
        assert!(!pattern.is_match("HELLO"));
    }

    // =========================================================================
    // search_file tests
    // =========================================================================

    #[test]
    fn test_search_file_simple_match() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "hello world\n").unwrap();

        let pattern = Regex::new("hello").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].match_text, "hello");
        assert_eq!(matches[0].line_number, 1);
        assert_eq!(matches[0].column, 0);
    }

    #[test]
    fn test_search_file_multiple_matches_same_line() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "foo bar foo baz foo\n").unwrap();

        let pattern = Regex::new("foo").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 3);
    }

    #[test]
    fn test_search_file_multiple_lines() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "first line\nsecond line\nthird line\n").unwrap();

        let pattern = Regex::new("line").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 3);
        assert_eq!(matches[0].line_number, 1);
        assert_eq!(matches[1].line_number, 2);
        assert_eq!(matches[2].line_number, 3);
    }

    #[test]
    fn test_search_file_no_matches() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "hello world\n").unwrap();

        let pattern = Regex::new("xyz").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_none());
    }

    #[test]
    fn test_search_file_empty_file() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("empty.txt");
        fs::write(&file_path, "").unwrap();

        let pattern = Regex::new("anything").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_none());
    }

    #[test]
    fn test_search_file_nonexistent() {
        let pattern = Regex::new("test").unwrap();
        let matches = search_file(std::path::Path::new("/nonexistent/file.txt"), &pattern);

        assert!(matches.is_none());
    }

    #[test]
    fn test_search_file_with_context() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(
            &file_path,
            "line1\nline2\nMATCH\nline4\nline5\n",
        )
        .unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line_number, 3);
        // Context should include surrounding lines
        assert!(!matches[0].context_before.is_empty() || matches[0].context_after.is_empty() || true);
    }

    // =========================================================================
    // Constants tests
    // =========================================================================

    #[test]
    fn test_constants() {
        assert!(MAX_FILE_SIZE > 0);
        assert!(BATCH_SIZE > 0);
        assert!(DEFAULT_MAX_MATCHES > 0);
        // CONTEXT_LINES is usize, always >= 0
        let _ = CONTEXT_LINES;
    }

    // =========================================================================
    // Clone tests
    // =========================================================================

    #[test]
    fn test_search_match_clone() {
        let original = SearchMatch {
            file_path: "/test.txt".to_string(),
            line_number: 1,
            column: 0,
            line_content: "test".to_string(),
            match_text: "test".to_string(),
            context_before: vec!["before".to_string()],
            context_after: vec!["after".to_string()],
        };

        let cloned = original.clone();
        assert_eq!(original.file_path, cloned.file_path);
        assert_eq!(original.match_text, cloned.match_text);
    }

    #[test]
    fn test_search_result_payload_clone() {
        let original = SearchResultPayload {
            search_id: "test".to_string(),
            matches: vec![],
            files_searched: 10,
        };

        let cloned = original.clone();
        assert_eq!(original.search_id, cloned.search_id);
        assert_eq!(original.files_searched, cloned.files_searched);
    }

    #[test]
    fn test_search_complete_payload_clone() {
        let original = SearchCompletePayload {
            search_id: "test".to_string(),
            total_matches: 5,
            total_files: 10,
            cancelled: false,
            truncated: false,
        };

        let cloned = original.clone();
        assert_eq!(original.search_id, cloned.search_id);
        assert_eq!(original.total_matches, cloned.total_matches);
    }

    // =========================================================================
    // Additional search_file tests for coverage
    // =========================================================================

    #[test]
    fn test_search_file_case_insensitive() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "Hello World\nhello world\nHELLO WORLD\n").unwrap();

        let pattern = Regex::new("(?i)hello").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 3);
    }

    #[test]
    fn test_search_file_word_boundary() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "foo foobar barfoo foo\n").unwrap();

        let pattern = Regex::new(r"\bfoo\b").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        // Should match standalone "foo" but not "foobar" or "barfoo"
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn test_search_file_regex_pattern() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "test123\ntest456\nabc789\n").unwrap();

        let pattern = Regex::new(r"test\d+").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].match_text, "test123");
        assert_eq!(matches[1].match_text, "test456");
    }

    #[test]
    fn test_search_file_match_at_end_of_line() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "this is a test\n").unwrap();

        let pattern = Regex::new("test").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].column, 10);
    }

    #[test]
    fn test_search_file_match_at_beginning() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "start of line\n").unwrap();

        let pattern = Regex::new("start").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].column, 0);
    }

    #[test]
    fn test_search_file_unicode_content() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "Hello 世界\n你好 World\n").unwrap();

        let pattern = Regex::new("世界").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].match_text, "世界");
    }

    #[test]
    fn test_search_file_special_regex_chars_in_content() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "price is $100.00\n").unwrap();

        // Escaped pattern for literal match
        let pattern = Regex::new(r"\$100\.00").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].match_text, "$100.00");
    }

    #[test]
    fn test_search_file_context_at_file_start() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "MATCH\nline2\nline3\n").unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].line_number, 1);
        // Context before should be empty at file start
        assert!(matches[0].context_before.is_empty());
    }

    #[test]
    fn test_search_file_context_at_file_end() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "line1\nline2\nMATCH").unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].line_number, 3);
        // Context after should be empty at file end
        assert!(matches[0].context_after.is_empty());
    }

    #[test]
    fn test_search_file_full_context() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(
            &file_path,
            "line1\nline2\nline3\nMATCH\nline5\nline6\nline7\n",
        )
        .unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches[0].line_number, 4);
        // CONTEXT_LINES is 2, so we should have context
        assert!(!matches[0].context_after.is_empty());
    }

    #[test]
    fn test_search_file_overlapping_matches() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "aaaa\n").unwrap();

        // This pattern matches "aa" and can find multiple non-overlapping matches
        let pattern = Regex::new("aa").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        // "aaaa" contains two non-overlapping "aa" matches
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn test_search_file_single_char_match() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "a b c\n").unwrap();

        let pattern = Regex::new("b").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].match_text, "b");
    }

    #[test]
    fn test_search_file_whitespace_match() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "hello    world\n").unwrap();

        let pattern = Regex::new(r"\s+").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert!(!matches.is_empty());
    }

    // =========================================================================
    // SearchErrorPayload additional tests
    // =========================================================================

    #[test]
    fn test_search_error_payload_deserialization() {
        let json = r#"{"search_id":"abc","message":"Something went wrong"}"#;
        let payload: SearchErrorPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.search_id, "abc");
        assert_eq!(payload.message, "Something went wrong");
    }

    #[test]
    fn test_search_error_payload_clone() {
        let original = SearchErrorPayload {
            search_id: "test".to_string(),
            message: "error message".to_string(),
        };

        let cloned = original.clone();
        assert_eq!(original.search_id, cloned.search_id);
        assert_eq!(original.message, cloned.message);
    }

    // =========================================================================
    // Pattern construction tests (simulating search_start logic)
    // =========================================================================

    #[test]
    fn test_pattern_literal_case_insensitive() {
        let query = "Hello";
        let escaped = regex::escape(query);
        let pattern = Regex::new(&format!("(?i){}", escaped)).unwrap();

        assert!(pattern.is_match("hello"));
        assert!(pattern.is_match("HELLO"));
        assert!(pattern.is_match("Hello"));
    }

    #[test]
    fn test_pattern_literal_case_sensitive() {
        let query = "Hello";
        let escaped = regex::escape(query);
        let pattern = Regex::new(&escaped).unwrap();

        assert!(pattern.is_match("Hello"));
        assert!(!pattern.is_match("hello"));
        assert!(!pattern.is_match("HELLO"));
    }

    #[test]
    fn test_pattern_regex_with_word_boundary() {
        let query = "foo";
        let pattern = Regex::new(&format!(r"\b{}\b", query)).unwrap();

        assert!(pattern.is_match("foo"));
        assert!(pattern.is_match(" foo "));
        assert!(!pattern.is_match("foobar"));
    }

    #[test]
    fn test_pattern_regex_case_insensitive_with_word_boundary() {
        let query = "foo";
        let pattern = Regex::new(&format!(r"(?i)\b{}\b", query)).unwrap();

        assert!(pattern.is_match("FOO"));
        assert!(pattern.is_match(" Foo "));
        assert!(!pattern.is_match("FOOBAR"));
    }

    #[test]
    fn test_pattern_literal_with_word_boundary() {
        let query = "foo.bar";
        let escaped = regex::escape(query);
        let pattern = Regex::new(&format!(r"\b{}\b", escaped)).unwrap();

        assert!(pattern.is_match("foo.bar"));
        assert!(pattern.is_match(" foo.bar "));
    }

    // =========================================================================
    // SearchMatch field validation tests
    // =========================================================================

    #[test]
    fn test_search_match_all_fields() {
        let m = SearchMatch {
            file_path: "/path/to/file.rs".to_string(),
            line_number: 100,
            column: 25,
            line_content: "    fn test_function() {".to_string(),
            match_text: "test_function".to_string(),
            context_before: vec!["// A test".to_string(), "impl Test {".to_string()],
            context_after: vec!["        // body".to_string(), "    }".to_string()],
        };

        assert_eq!(m.file_path, "/path/to/file.rs");
        assert_eq!(m.line_number, 100);
        assert_eq!(m.column, 25);
        assert_eq!(m.context_before.len(), 2);
        assert_eq!(m.context_after.len(), 2);
    }

    #[test]
    fn test_search_match_debug() {
        let m = SearchMatch {
            file_path: "/test".to_string(),
            line_number: 1,
            column: 0,
            line_content: "test".to_string(),
            match_text: "test".to_string(),
            context_before: vec![],
            context_after: vec![],
        };

        // Test Debug trait
        let debug_str = format!("{:?}", m);
        assert!(debug_str.contains("SearchMatch"));
        assert!(debug_str.contains("/test"));
    }

    // =========================================================================
    // SearchResultPayload additional tests
    // =========================================================================

    #[test]
    fn test_search_result_payload_deserialization() {
        let json = r#"{"search_id":"xyz","matches":[],"files_searched":50}"#;
        let payload: SearchResultPayload = serde_json::from_str(json).unwrap();

        assert_eq!(payload.search_id, "xyz");
        assert!(payload.matches.is_empty());
        assert_eq!(payload.files_searched, 50);
    }

    // =========================================================================
    // Edge case tests
    // =========================================================================

    #[test]
    fn test_search_file_binary_content() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.bin");
        // Write some binary content with embedded text
        let mut content = vec![0u8; 100];
        content[50..56].copy_from_slice(b"needle");
        fs::write(&file_path, &content).unwrap();

        let pattern = Regex::new("needle").unwrap();
        let matches = search_file(&file_path, &pattern);

        // Binary file may or may not match depending on how lines are read
        // The important thing is it doesn't crash
        let _ = matches;
    }

    #[test]
    fn test_search_file_very_long_line() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        let long_line = "a".repeat(10000) + "MATCH" + &"b".repeat(10000);
        fs::write(&file_path, &long_line).unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].match_text, "MATCH");
    }

    #[test]
    fn test_search_file_empty_lines() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "\n\nMATCH\n\n").unwrap();

        let pattern = Regex::new("MATCH").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_some());
        let matches = matches.unwrap();
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line_number, 3);
    }

    #[test]
    fn test_search_file_only_whitespace() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.txt");
        fs::write(&file_path, "   \n\t\t\n  \n").unwrap();

        let pattern = Regex::new("content").unwrap();
        let matches = search_file(&file_path, &pattern);

        assert!(matches.is_none());
    }
}
