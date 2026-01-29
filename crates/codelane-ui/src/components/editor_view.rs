//! Editor view component
//!
//! This component provides a higher-level wrapper around the Monaco editor,
//! with tab management and file integration.

use codelane_editor::{Language, monaco::MonacoConfig};
use dioxus::prelude::*;

/// A single editor tab
#[derive(Debug, Clone, PartialEq)]
pub struct EditorTab {
    /// Unique ID for this tab
    pub id: String,
    /// Display name (usually filename)
    pub name: String,
    /// Full file path
    pub path: Option<String>,
    /// Content of the file
    pub content: String,
    /// Language mode
    pub language: Language,
    /// Whether the content has been modified
    pub dirty: bool,
    /// Whether this is a new unsaved file
    pub is_new: bool,
}

impl EditorTab {
    /// Create a new editor tab
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        content: impl Into<String>,
        language: Language,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            path: None,
            content: content.into(),
            language,
            dirty: false,
            is_new: true,
        }
    }

    /// Create a tab from a file path
    pub fn from_path(
        id: impl Into<String>,
        path: impl Into<String>,
        content: impl Into<String>,
    ) -> Self {
        let path_str: String = path.into();
        let name = std::path::Path::new(&path_str)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "untitled".to_string());

        let extension = std::path::Path::new(&path_str)
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        let language = Language::from_extension(&extension);

        Self {
            id: id.into(),
            name,
            path: Some(path_str),
            content: content.into(),
            language,
            dirty: false,
            is_new: false,
        }
    }
}

/// Props for EditorView component
#[derive(Props, Clone, PartialEq)]
pub struct EditorViewProps {
    /// List of editor tabs
    #[props(default)]
    pub tabs: Vec<EditorTab>,

    /// Currently active tab ID
    #[props(default)]
    pub active_tab: Option<String>,

    /// Editor configuration
    #[props(default)]
    pub config: MonacoConfig,

    /// Callback when content changes
    #[props(default)]
    pub on_content_change: Option<EventHandler<(String, String)>>, // (tab_id, content)

    /// Callback when save is triggered
    #[props(default)]
    pub on_save: Option<EventHandler<String>>, // tab_id

    /// Callback when tab is selected
    #[props(default)]
    pub on_tab_select: Option<EventHandler<String>>, // tab_id

    /// Callback when tab is closed
    #[props(default)]
    pub on_tab_close: Option<EventHandler<String>>, // tab_id
}

/// Editor view component with tab management
///
/// This component provides a tabbed editor interface, managing multiple
/// files with Monaco editor instances.
#[component]
pub fn EditorView(props: EditorViewProps) -> Element {
    let active_tab = props.active_tab.clone().or_else(|| {
        props.tabs.first().map(|t| t.id.clone())
    });

    let active_content = active_tab.as_ref().and_then(|id| {
        props.tabs.iter().find(|t| &t.id == id)
    });

    rsx! {
        div {
            class: "editor-view flex flex-col h-full",

            // Tab bar
            if !props.tabs.is_empty() {
                div {
                    class: "editor-tabs flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto",

                    for tab in props.tabs.iter() {
                        {
                            let tab_id = tab.id.clone();
                            let is_active = active_tab.as_ref() == Some(&tab.id);
                            let on_tab_select = props.on_tab_select.clone();
                            let on_tab_close = props.on_tab_close.clone();

                            rsx! {
                                div {
                                    key: "{tab.id}",
                                    class: format!(
                                        "editor-tab flex items-center px-3 py-2 text-sm cursor-pointer border-r border-gray-700 {}",
                                        if is_active { "bg-gray-900 text-white" } else { "bg-gray-800 text-gray-400 hover:bg-gray-700" }
                                    ),
                                    onclick: {
                                        let tab_id = tab_id.clone();
                                        move |_| {
                                            if let Some(ref handler) = on_tab_select {
                                                handler.call(tab_id.clone());
                                            }
                                        }
                                    },

                                    span {
                                        class: "tab-name truncate max-w-32",
                                        "{tab.name}"
                                    }

                                    if tab.dirty {
                                        span {
                                            class: "ml-1 text-blue-400",
                                            "*"
                                        }
                                    }

                                    button {
                                        class: "ml-2 p-0.5 rounded hover:bg-gray-600 text-gray-500 hover:text-gray-300",
                                        onclick: {
                                            let tab_id = tab_id.clone();
                                            move |e: Event<MouseData>| {
                                                e.stop_propagation();
                                                if let Some(ref handler) = on_tab_close {
                                                    handler.call(tab_id.clone());
                                                }
                                            }
                                        },
                                        "x"
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Editor content
            div {
                class: "editor-content flex-1 min-h-0",

                if let Some(tab) = active_content {
                    div {
                        class: "h-full",
                        // Note: The actual Monaco editor would be rendered here
                        // This is a placeholder that shows the content
                        div {
                            class: "h-full bg-gray-900 text-gray-300 p-4 font-mono text-sm overflow-auto",
                            "Editor for: {tab.name}"
                            pre {
                                class: "mt-4 whitespace-pre-wrap",
                                "{tab.content}"
                            }
                        }
                    }
                } else {
                    // Empty state
                    div {
                        class: "h-full flex items-center justify-center bg-gray-900",
                        div {
                            class: "text-center text-gray-500",
                            p { "No file open" }
                            p {
                                class: "text-sm mt-2",
                                "Open a file to start editing"
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Simple code viewer component (read-only)
#[component]
pub fn CodeViewer(
    /// The code content to display
    content: String,
    /// Language for syntax highlighting
    #[props(default = Language::PlainText)]
    language: Language,
    /// Optional title
    #[props(default)]
    title: Option<String>,
) -> Element {
    rsx! {
        div {
            class: "code-viewer flex flex-col h-full bg-gray-900 rounded overflow-hidden",

            if let Some(title) = title {
                div {
                    class: "px-3 py-2 bg-gray-800 border-b border-gray-700 text-sm text-gray-400",
                    "{title}"
                }
            }

            div {
                class: "flex-1 overflow-auto",
                pre {
                    class: "p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap",
                    "{content}"
                }
            }
        }
    }
}
