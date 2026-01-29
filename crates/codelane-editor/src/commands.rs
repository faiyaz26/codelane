//! Editor commands

/// Commands that can be executed on the Monaco editor
#[derive(Debug, Clone)]
pub enum EditorCommand {
    /// Set editor content
    SetContent(String),

    /// Insert text at cursor
    InsertText(String),

    /// Go to line
    GoToLine(u32),

    /// Set selection
    SetSelection {
        start_line: u32,
        start_column: u32,
        end_line: u32,
        end_column: u32,
    },

    /// Format document
    Format,

    /// Undo
    Undo,

    /// Redo
    Redo,

    /// Find
    Find(String),

    /// Replace
    Replace { find: String, replace: String },

    /// Fold all
    FoldAll,

    /// Unfold all
    UnfoldAll,
}

impl EditorCommand {
    /// Generate JavaScript to execute this command
    pub fn to_js(&self, editor_id: &str) -> String {
        match self {
            EditorCommand::SetContent(content) => {
                let escaped = serde_json::to_string(content).unwrap();
                format!(
                    "window.monacoEditors['{}']?.setValue({});",
                    editor_id, escaped
                )
            }
            EditorCommand::InsertText(text) => {
                let escaped = serde_json::to_string(text).unwrap();
                format!(
                    "window.monacoEditors['{}']?.trigger('keyboard', 'type', {{ text: {} }});",
                    editor_id, escaped
                )
            }
            EditorCommand::GoToLine(line) => {
                format!(
                    "window.monacoEditors['{}']?.revealLineInCenter({});",
                    editor_id, line
                )
            }
            EditorCommand::SetSelection {
                start_line,
                start_column,
                end_line,
                end_column,
            } => {
                format!(
                    "window.monacoEditors['{}']?.setSelection({{ startLineNumber: {}, startColumn: {}, endLineNumber: {}, endColumn: {} }});",
                    editor_id, start_line, start_column, end_line, end_column
                )
            }
            EditorCommand::Format => {
                format!(
                    "window.monacoEditors['{}']?.getAction('editor.action.formatDocument')?.run();",
                    editor_id
                )
            }
            EditorCommand::Undo => {
                format!(
                    "window.monacoEditors['{}']?.trigger('keyboard', 'undo');",
                    editor_id
                )
            }
            EditorCommand::Redo => {
                format!(
                    "window.monacoEditors['{}']?.trigger('keyboard', 'redo');",
                    editor_id
                )
            }
            EditorCommand::Find(query) => {
                let escaped = serde_json::to_string(query).unwrap();
                format!(
                    "window.monacoEditors['{}']?.getAction('actions.find')?.run(); window.monacoEditors['{}']?.getContribution('editor.contrib.findController')?.setSearchString({});",
                    editor_id, editor_id, escaped
                )
            }
            EditorCommand::Replace { find, replace } => {
                let find_escaped = serde_json::to_string(find).unwrap();
                let replace_escaped = serde_json::to_string(replace).unwrap();
                format!(
                    "const ctrl = window.monacoEditors['{}']?.getContribution('editor.contrib.findController'); ctrl?.setSearchString({}); ctrl?.setReplaceString({});",
                    editor_id, find_escaped, replace_escaped
                )
            }
            EditorCommand::FoldAll => {
                format!(
                    "window.monacoEditors['{}']?.getAction('editor.foldAll')?.run();",
                    editor_id
                )
            }
            EditorCommand::UnfoldAll => {
                format!(
                    "window.monacoEditors['{}']?.getAction('editor.unfoldAll')?.run();",
                    editor_id
                )
            }
        }
    }
}
