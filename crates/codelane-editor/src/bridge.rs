//! Monaco Editor JavaScript bridge utilities
//!
//! This module provides utilities for generating JavaScript code that
//! interacts with the Monaco Editor bridge layer.
//!
//! # JavaScript Files
//!
//! The Monaco integration requires two JavaScript files to be loaded in the WebView:
//!
//! 1. `assets/js/monaco-loader.js` - Loads Monaco from CDN and initializes global state
//! 2. `assets/js/monaco-bridge.js` - Bridge functions that Rust can call via eval
//!
//! These should be loaded via script tags in your HTML template or injected at runtime.
//!
//! # Example HTML Setup
//!
//! ```html
//! <script src="assets/js/monaco-loader.js"></script>
//! <script src="assets/js/monaco-bridge.js"></script>
//! ```

use crate::monaco::MonacoConfig;
use crate::Language;

/// CDN URL for Monaco Editor loader
pub const MONACO_CDN_LOADER: &str = "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js";

/// Monaco version used
pub const MONACO_VERSION: &str = "0.45.0";

/// Generate inline JavaScript to bootstrap Monaco from CDN
///
/// This returns JavaScript that can be injected into the page to load Monaco.
/// Call this via eval() during app initialization.
pub fn get_monaco_bootstrap_script() -> String {
    format!(
        r#"
(function() {{
    if (window.monaco) return Promise.resolve();

    window.monacoEditors = window.monacoEditors || {{}};
    window.monacoReady = false;
    window.monacoReadyCallbacks = [];

    window.onMonacoReady = function(callback) {{
        if (window.monacoReady && window.monaco) {{
            callback(window.monaco);
        }} else {{
            window.monacoReadyCallbacks.push(callback);
        }}
    }};

    return new Promise(function(resolve, reject) {{
        var script = document.createElement('script');
        script.src = '{}';
        script.onload = function() {{
            require.config({{
                paths: {{ 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@{}/min/vs' }}
            }});
            require(['vs/editor/editor.main'], function() {{
                window.monacoReady = true;
                window.monacoReadyCallbacks.forEach(function(cb) {{ cb(window.monaco); }});
                window.monacoReadyCallbacks = [];
                resolve();
            }});
        }};
        script.onerror = reject;
        document.head.appendChild(script);
    }});
}})()
"#,
        MONACO_CDN_LOADER,
        MONACO_VERSION
    )
}

/// Generate JavaScript to register the Codelane dark theme
///
/// This should be called after Monaco is loaded.
pub fn get_theme_registration_script() -> &'static str {
    r#"
(function() {
    if (!window.monaco) return;

    window.monaco.editor.defineTheme('codelane-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'C586C0' },
            { token: 'string', foreground: 'CE9178' },
            { token: 'number', foreground: 'B5CEA8' },
            { token: 'type', foreground: '4EC9B0' },
            { token: 'function', foreground: 'DCDCAA' },
            { token: 'variable', foreground: '9CDCFE' },
            { token: 'constant', foreground: '4FC1FF' },
        ],
        colors: {
            'editor.background': '#111827',
            'editor.foreground': '#D4D4D4',
            'editorCursor.foreground': '#AEAFAD',
            'editor.lineHighlightBackground': '#1F2937',
            'editorLineNumber.foreground': '#4B5563',
            'editorLineNumber.activeForeground': '#9CA3AF',
            'editor.selectionBackground': '#374151',
            'editorIndentGuide.background1': '#374151',
            'editorWidget.background': '#1F2937',
            'editorWidget.border': '#374151',
            'minimap.background': '#111827',
            'scrollbarSlider.background': '#37415180',
        }
    });

    window.monaco.editor.setTheme('codelane-dark');
})()
"#
}

/// JavaScript code generator for Monaco operations
pub struct MonacoJsBuilder {
    editor_id: String,
}

impl MonacoJsBuilder {
    /// Create a new JavaScript builder for the given editor ID
    pub fn new(editor_id: impl Into<String>) -> Self {
        Self {
            editor_id: editor_id.into(),
        }
    }

    /// Generate JS to create an editor
    pub fn create_editor(&self, container_id: &str, config: &MonacoConfig, content: &str, language: Language) -> String {
        let content_json = serde_json::to_string(content).unwrap_or_else(|_| "\"\"".to_string());
        let font_family_json = serde_json::to_string(&config.font_family).unwrap_or_else(|_| "\"monospace\"".to_string());

        format!(
            r#"window.createMonacoEditor('{}', {{
    editorId: '{}',
    value: {},
    language: '{}',
    theme: '{}',
    fontSize: {},
    fontFamily: {},
    tabSize: {},
    insertSpaces: {},
    wordWrap: '{}',
    minimap: {{ enabled: {} }},
    lineNumbers: '{}',
    readOnly: {}
}})"#,
            container_id,
            self.editor_id,
            content_json,
            language.monaco_id(),
            config.theme,
            config.font_size,
            font_family_json,
            config.tab_size,
            config.insert_spaces,
            config.word_wrap,
            config.minimap_enabled,
            config.line_numbers,
            config.read_only,
        )
    }

    /// Generate JS to set editor content
    pub fn set_content(&self, content: &str) -> String {
        let content_json = serde_json::to_string(content).unwrap_or_else(|_| "\"\"".to_string());
        format!("window.setMonacoContent('{}', {})", self.editor_id, content_json)
    }

    /// Generate JS to get editor content
    pub fn get_content(&self) -> String {
        format!("window.getMonacoContent('{}')", self.editor_id)
    }

    /// Generate JS to set language
    pub fn set_language(&self, language: Language) -> String {
        format!(
            "window.setMonacoLanguage('{}', '{}')",
            self.editor_id,
            language.monaco_id()
        )
    }

    /// Generate JS to set theme (global)
    pub fn set_theme(theme: &str) -> String {
        format!("window.setMonacoTheme('{}')", theme)
    }

    /// Generate JS to dispose editor
    pub fn dispose(&self) -> String {
        format!("window.disposeMonacoEditor('{}')", self.editor_id)
    }

    /// Generate JS to go to line
    pub fn go_to_line(&self, line: u32) -> String {
        format!("window.goToMonacoLine('{}', {})", self.editor_id, line)
    }

    /// Generate JS to set selection
    pub fn set_selection(&self, start_line: u32, start_col: u32, end_line: u32, end_col: u32) -> String {
        format!(
            "window.setMonacoSelection('{}', {}, {}, {}, {})",
            self.editor_id, start_line, start_col, end_line, end_col
        )
    }

    /// Generate JS to focus editor
    pub fn focus(&self) -> String {
        format!("window.focusMonacoEditor('{}')", self.editor_id)
    }

    /// Generate JS to set read-only mode
    pub fn set_read_only(&self, read_only: bool) -> String {
        format!("window.setMonacoReadOnly('{}', {})", self.editor_id, read_only)
    }

    /// Generate JS to update options
    pub fn update_options(&self, options: &MonacoConfig) -> String {
        let options_json = serde_json::to_string(options).unwrap_or_else(|_| "{}".to_string());
        format!("window.updateMonacoOptions('{}', {})", self.editor_id, options_json)
    }

    /// Generate JS to execute an action
    pub fn execute_action(&self, action_id: &str) -> String {
        format!("window.executeMonacoAction('{}', '{}')", self.editor_id, action_id)
    }

    /// Generate JS to insert text at cursor
    pub fn insert_text(&self, text: &str) -> String {
        let text_json = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string());
        format!("window.insertMonacoText('{}', {})", self.editor_id, text_json)
    }

    /// Generate JS to get cursor position
    pub fn get_cursor_position(&self) -> String {
        format!("window.getMonacoCursorPosition('{}')", self.editor_id)
    }

    /// Generate JS to layout all editors
    pub fn layout_all() -> String {
        "window.layoutMonacoEditors()".to_string()
    }

    /// Generate JS to check if Monaco is ready
    pub fn is_ready() -> String {
        "window.isMonacoReady()".to_string()
    }
}

/// Common Monaco action IDs
pub mod actions {
    /// Format document
    pub const FORMAT_DOCUMENT: &str = "editor.action.formatDocument";
    /// Format selection
    pub const FORMAT_SELECTION: &str = "editor.action.formatSelection";
    /// Find
    pub const FIND: &str = "actions.find";
    /// Find and replace
    pub const FIND_REPLACE: &str = "editor.action.startFindReplaceAction";
    /// Go to line
    pub const GO_TO_LINE: &str = "editor.action.gotoLine";
    /// Toggle comment
    pub const TOGGLE_COMMENT: &str = "editor.action.commentLine";
    /// Toggle block comment
    pub const TOGGLE_BLOCK_COMMENT: &str = "editor.action.blockComment";
    /// Fold
    pub const FOLD: &str = "editor.fold";
    /// Unfold
    pub const UNFOLD: &str = "editor.unfold";
    /// Fold all
    pub const FOLD_ALL: &str = "editor.foldAll";
    /// Unfold all
    pub const UNFOLD_ALL: &str = "editor.unfoldAll";
    /// Undo
    pub const UNDO: &str = "undo";
    /// Redo
    pub const REDO: &str = "redo";
    /// Select all
    pub const SELECT_ALL: &str = "editor.action.selectAll";
    /// Copy
    pub const COPY: &str = "editor.action.clipboardCopyAction";
    /// Cut
    pub const CUT: &str = "editor.action.clipboardCutAction";
    /// Paste
    pub const PASTE: &str = "editor.action.clipboardPasteAction";
    /// Trigger suggest
    pub const TRIGGER_SUGGEST: &str = "editor.action.triggerSuggest";
    /// Trigger parameter hints
    pub const TRIGGER_PARAMETER_HINTS: &str = "editor.action.triggerParameterHints";
    /// Quick fix
    pub const QUICK_FIX: &str = "editor.action.quickFix";
    /// Go to definition
    pub const GO_TO_DEFINITION: &str = "editor.action.revealDefinition";
    /// Peek definition
    pub const PEEK_DEFINITION: &str = "editor.action.peekDefinition";
    /// Go to references
    pub const GO_TO_REFERENCES: &str = "editor.action.goToReferences";
    /// Rename symbol
    pub const RENAME: &str = "editor.action.rename";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_js_builder_create_editor() {
        let builder = MonacoJsBuilder::new("test_editor");
        let config = MonacoConfig::default();
        let js = builder.create_editor("container", &config, "hello", Language::Rust);

        assert!(js.contains("createMonacoEditor"));
        assert!(js.contains("test_editor"));
        assert!(js.contains("rust"));
    }

    #[test]
    fn test_js_builder_set_content() {
        let builder = MonacoJsBuilder::new("test_editor");
        let js = builder.set_content("fn main() {}");

        assert!(js.contains("setMonacoContent"));
        assert!(js.contains("test_editor"));
    }

    #[test]
    fn test_js_builder_set_language() {
        let builder = MonacoJsBuilder::new("test_editor");
        let js = builder.set_language(Language::TypeScript);

        assert!(js.contains("setMonacoLanguage"));
        assert!(js.contains("typescript"));
    }
}
