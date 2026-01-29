//! Monaco editor hook
//!
//! This module provides hooks for working with Monaco editor instances.

use codelane_editor::{Language, monaco::MonacoConfig};
use dioxus::prelude::*;
use std::collections::HashMap;

/// State for tracking Monaco editor instances
#[derive(Debug, Clone, Default)]
pub struct MonacoState {
    /// Map of editor IDs to their initialization state
    pub editors: HashMap<String, EditorInstanceState>,
    /// Whether Monaco has been loaded
    pub monaco_loaded: bool,
    /// Current global theme
    pub current_theme: String,
}

/// State for an individual editor instance
#[derive(Debug, Clone)]
pub struct EditorInstanceState {
    /// The editor ID
    pub id: String,
    /// Whether the editor has been initialized
    pub initialized: bool,
    /// Current content
    pub content: String,
    /// Current language
    pub language: Language,
    /// Whether the content is dirty (modified)
    pub dirty: bool,
    /// Current cursor position (line, column)
    pub cursor_position: (u32, u32),
}

impl Default for EditorInstanceState {
    fn default() -> Self {
        Self {
            id: String::new(),
            initialized: false,
            content: String::new(),
            language: Language::PlainText,
            dirty: false,
            cursor_position: (1, 1),
        }
    }
}

/// Hook result for Monaco editor management
#[derive(Clone, Copy)]
pub struct UseMonaco {
    state: Signal<MonacoState>,
}

impl UseMonaco {
    /// Check if Monaco is loaded and ready
    pub fn is_ready(&self) -> bool {
        self.state.read().monaco_loaded
    }

    /// Get the current theme
    pub fn current_theme(&self) -> String {
        self.state.read().current_theme.clone()
    }

    /// Set Monaco as loaded
    pub fn set_loaded(&mut self, loaded: bool) {
        self.state.write().monaco_loaded = loaded;
    }

    /// Set the current theme
    pub fn set_theme(&mut self, theme: impl Into<String>) {
        self.state.write().current_theme = theme.into();
    }

    /// Register an editor instance
    pub fn register_editor(&mut self, id: impl Into<String>, language: Language) {
        let id = id.into();
        self.state.write().editors.insert(
            id.clone(),
            EditorInstanceState {
                id,
                language,
                ..Default::default()
            },
        );
    }

    /// Unregister an editor instance
    pub fn unregister_editor(&mut self, id: &str) {
        self.state.write().editors.remove(id);
    }

    /// Mark an editor as initialized
    pub fn set_editor_initialized(&mut self, id: &str, initialized: bool) {
        if let Some(editor) = self.state.write().editors.get_mut(id) {
            editor.initialized = initialized;
        }
    }

    /// Update editor content state
    pub fn set_editor_content(&mut self, id: &str, content: impl Into<String>) {
        if let Some(editor) = self.state.write().editors.get_mut(id) {
            editor.content = content.into();
        }
    }

    /// Update editor dirty state
    pub fn set_editor_dirty(&mut self, id: &str, dirty: bool) {
        if let Some(editor) = self.state.write().editors.get_mut(id) {
            editor.dirty = dirty;
        }
    }

    /// Update editor cursor position
    pub fn set_editor_cursor(&mut self, id: &str, line: u32, column: u32) {
        if let Some(editor) = self.state.write().editors.get_mut(id) {
            editor.cursor_position = (line, column);
        }
    }

    /// Get editor state
    pub fn get_editor(&self, id: &str) -> Option<EditorInstanceState> {
        self.state.read().editors.get(id).cloned()
    }

    /// Check if an editor is initialized
    pub fn is_editor_initialized(&self, id: &str) -> bool {
        self.state
            .read()
            .editors
            .get(id)
            .is_some_and(|e| e.initialized)
    }

    /// Get all registered editor IDs
    pub fn get_editor_ids(&self) -> Vec<String> {
        self.state.read().editors.keys().cloned().collect()
    }
}

/// Hook to manage Monaco editor state globally
///
/// This hook provides a way to track Monaco editor instances and their state
/// across the application. It's useful for coordinating multiple editors.
///
/// # Example
///
/// ```rust,ignore
/// fn MyComponent() -> Element {
///     let mut monaco = use_monaco();
///
///     // Check if Monaco is ready
///     if monaco.is_ready() {
///         // Monaco is loaded and ready
///     }
///
///     // Register an editor
///     monaco.register_editor("main_editor", Language::Rust);
/// }
/// ```
pub fn use_monaco() -> UseMonaco {
    let state = use_context_provider(|| {
        Signal::new(MonacoState {
            editors: HashMap::new(),
            monaco_loaded: false,
            current_theme: "codelane-dark".to_string(),
        })
    });

    UseMonaco { state }
}

/// Hook to use Monaco state from context (for child components)
pub fn use_monaco_context() -> UseMonaco {
    let state = use_context::<Signal<MonacoState>>();
    UseMonaco { state }
}

/// Props for editor state
#[derive(Clone, Debug, PartialEq)]
pub struct EditorProps {
    /// Initial content
    pub content: String,
    /// Language mode
    pub language: Language,
    /// Editor configuration
    pub config: MonacoConfig,
    /// File path (optional)
    pub file_path: Option<String>,
    /// Whether read-only
    pub read_only: bool,
}

impl Default for EditorProps {
    fn default() -> Self {
        Self {
            content: String::new(),
            language: Language::PlainText,
            config: MonacoConfig::default(),
            file_path: None,
            read_only: false,
        }
    }
}

impl EditorProps {
    /// Create new editor props
    pub fn new(content: impl Into<String>, language: Language) -> Self {
        Self {
            content: content.into(),
            language,
            ..Default::default()
        }
    }

    /// Set the file path
    pub fn with_file_path(mut self, path: impl Into<String>) -> Self {
        self.file_path = Some(path.into());
        self
    }

    /// Set read-only mode
    pub fn with_read_only(mut self, read_only: bool) -> Self {
        self.read_only = read_only;
        self
    }

    /// Set the configuration
    pub fn with_config(mut self, config: MonacoConfig) -> Self {
        self.config = config;
        self
    }
}
