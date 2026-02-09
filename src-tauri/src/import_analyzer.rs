//! Import analysis using Tree-sitter for dependency-aware file sorting
//!
//! Extracts import/use statements from source files to build dependency graphs
//! for smart file ordering in code review.

use std::path::Path;
use tree_sitter::{Language, Parser, Query, QueryCursor};

/// Supported languages for import analysis
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnalysisLanguage {
    TypeScript,
    JavaScript,
    Python,
    Rust,
    Go,
}

impl AnalysisLanguage {
    /// Detect language from file extension
    pub fn from_path(path: &str) -> Option<Self> {
        let path_lower = path.to_lowercase();

        if path_lower.ends_with(".ts") || path_lower.ends_with(".tsx") {
            Some(Self::TypeScript)
        } else if path_lower.ends_with(".js") || path_lower.ends_with(".jsx") || path_lower.ends_with(".mjs") {
            Some(Self::JavaScript)
        } else if path_lower.ends_with(".py") || path_lower.ends_with(".pyi") {
            Some(Self::Python)
        } else if path_lower.ends_with(".rs") {
            Some(Self::Rust)
        } else if path_lower.ends_with(".go") {
            Some(Self::Go)
        } else {
            None
        }
    }

    /// Get tree-sitter language parser
    fn tree_sitter_language(&self) -> Language {
        match self {
            Self::TypeScript => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
            Self::JavaScript => tree_sitter_javascript::LANGUAGE.into(),
            Self::Python => tree_sitter_python::LANGUAGE.into(),
            Self::Rust => tree_sitter_rust::LANGUAGE.into(),
            Self::Go => tree_sitter_go::LANGUAGE.into(),
        }
    }

    /// Get tree-sitter query for extracting imports
    fn import_query(&self) -> &'static str {
        match self {
            Self::TypeScript | Self::JavaScript => {
                // Capture import statements and their sources
                r#"
                (import_statement
                    source: (string) @import_source)

                (import_statement
                    source: (string
                        (string_fragment) @import_path))
                "#
            }
            Self::Python => {
                // Capture import and from...import statements
                r#"
                (import_statement
                    name: (dotted_name) @import_name)

                (import_from_statement
                    module_name: (dotted_name) @import_module)
                "#
            }
            Self::Rust => {
                // Capture use declarations
                r#"
                (use_declaration
                    argument: (scoped_identifier) @use_path)

                (use_declaration
                    argument: (identifier) @use_name)

                (use_declaration
                    argument: (use_list) @use_list)
                "#
            }
            Self::Go => {
                // Capture import declarations
                r#"
                (import_declaration
                    (import_spec
                        path: (interpreted_string_literal) @import_path))
                "#
            }
        }
    }
}

/// Extract import paths from a source file
pub fn extract_imports(file_path: &str, content: &str) -> Result<Vec<String>, String> {
    let language = match AnalysisLanguage::from_path(file_path) {
        Some(lang) => lang,
        None => return Ok(Vec::new()), // Unsupported language
    };

    let mut parser = Parser::new();
    parser
        .set_language(&language.tree_sitter_language())
        .map_err(|e| format!("Failed to set parser language: {}", e))?;

    let tree = parser
        .parse(content, None)
        .ok_or_else(|| "Failed to parse file".to_string())?;

    let root_node = tree.root_node();

    // For now, use a simpler regex-based approach for import extraction
    // Tree-sitter integration can be added later with proper streaming iterator handling
    let imports = extract_imports_regex(content, language);
    Ok(imports)
}

/// Simple regex-based import extraction (fallback when tree-sitter is complex)
fn extract_imports_regex(content: &str, language: AnalysisLanguage) -> Vec<String> {
    let mut imports = Vec::new();

    match language {
        AnalysisLanguage::TypeScript | AnalysisLanguage::JavaScript => {
            // Match: import ... from "..." or import ... from '...'
            let re = regex::Regex::new(r#"import\s+.*?\s+from\s+['"]([^'"]+)['"]"#).unwrap();
            for cap in re.captures_iter(content) {
                if let Some(path) = cap.get(1) {
                    let path_str = path.as_str();
                    if path_str.starts_with('.') {
                        imports.push(path_str.to_string());
                    }
                }
            }
        }
        AnalysisLanguage::Python => {
            // Match: from . import ... or from .. import ...
            let re = regex::Regex::new(r"from\s+(\.+\w*)\s+import").unwrap();
            for cap in re.captures_iter(content) {
                if let Some(path) = cap.get(1) {
                    let path_str = path.as_str();
                    if path_str.starts_with('.') {
                        imports.push(path_str.to_string());
                    }
                }
            }
        }
        AnalysisLanguage::Rust => {
            // Match: use crate::... or use super::... or use self::...
            let re = regex::Regex::new(r"use\s+((?:crate|super|self)::\S+)").unwrap();
            for cap in re.captures_iter(content) {
                if let Some(path) = cap.get(1) {
                    imports.push(path.as_str().to_string());
                }
            }
        }
        AnalysisLanguage::Go => {
            // Match: import "..." (relative paths starting with .)
            let re = regex::Regex::new(r#"import\s+"(\.+[^"]+)""#).unwrap();
            for cap in re.captures_iter(content) {
                if let Some(path) = cap.get(1) {
                    imports.push(path.as_str().to_string());
                }
            }
        }
    }

    // Deduplicate
    imports.sort();
    imports.dedup();
    imports
}

/// Clean and normalize import path
fn clean_import_path(raw: &str, language: AnalysisLanguage) -> String {
    let mut cleaned = raw.trim();

    // Remove quotes for string literals
    if cleaned.starts_with('"') || cleaned.starts_with('\'') {
        cleaned = cleaned.trim_matches(|c| c == '"' || c == '\'');
    }

    match language {
        AnalysisLanguage::TypeScript | AnalysisLanguage::JavaScript => {
            // Only keep relative imports (./...) for dependency analysis
            // Absolute imports and node_modules are external dependencies
            if cleaned.starts_with('.') {
                cleaned.to_string()
            } else {
                String::new()
            }
        }
        AnalysisLanguage::Python => {
            // Convert dotted names to paths
            // e.g., "mypackage.utils" -> "mypackage/utils"
            if cleaned.starts_with('.') {
                // Relative import
                cleaned.to_string()
            } else {
                String::new() // External package
            }
        }
        AnalysisLanguage::Rust => {
            // Only keep crate-relative imports
            // e.g., "crate::module::function" -> "crate::module"
            if cleaned.starts_with("crate::") || cleaned.starts_with("super::") || cleaned.starts_with("self::") {
                cleaned.to_string()
            } else {
                String::new()
            }
        }
        AnalysisLanguage::Go => {
            // Only keep relative imports
            if cleaned.starts_with('.') {
                cleaned.to_string()
            } else {
                String::new()
            }
        }
    }
}

/// Resolve import path to an actual file path
pub fn resolve_import_path(
    importing_file: &str,
    import_specifier: &str,
    language: AnalysisLanguage,
) -> Option<String> {
    let importing_dir = Path::new(importing_file).parent()?;

    match language {
        AnalysisLanguage::TypeScript | AnalysisLanguage::JavaScript => {
            // Handle relative imports: "./module", "../utils"
            if import_specifier.starts_with('.') {
                let resolved = importing_dir.join(import_specifier);
                let resolved_str = resolved.to_str()?.to_string();

                // Try various extensions
                let extensions = if language == AnalysisLanguage::TypeScript {
                    vec!["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]
                } else {
                    vec!["", ".js", ".jsx", ".mjs", "/index.js", "/index.jsx"]
                };

                for ext in extensions {
                    let candidate = format!("{}{}", resolved_str, ext);
                    // We can't check file existence here as we're analyzing changed files only
                    // So we return the normalized path
                    if !ext.is_empty() {
                        return Some(candidate);
                    }
                }

                Some(resolved_str)
            } else {
                None
            }
        }
        AnalysisLanguage::Rust => {
            // Convert Rust module path to file path
            // "crate::module::submodule" -> "src/module/submodule.rs"
            if import_specifier.starts_with("crate::") {
                let path = import_specifier
                    .trim_start_matches("crate::")
                    .replace("::", "/");
                Some(format!("src/{}.rs", path))
            } else if import_specifier.starts_with("super::") {
                // Handle super:: (parent module)
                let parent = importing_dir.parent()?;
                let path = import_specifier.trim_start_matches("super::").replace("::", "/");
                Some(format!("{}/{}.rs", parent.display(), path))
            } else {
                None
            }
        }
        AnalysisLanguage::Python => {
            // Handle relative imports
            if import_specifier.starts_with('.') {
                let level = import_specifier.chars().take_while(|c| *c == '.').count();
                let module = import_specifier.trim_start_matches('.');

                let mut current_dir = importing_dir;
                for _ in 1..level {
                    current_dir = current_dir.parent()?;
                }

                let module_path = module.replace('.', "/");
                let resolved = current_dir.join(&module_path);

                // Try .py or __init__.py
                let resolved_str = resolved.to_str()?.to_string();
                Some(format!("{}.py", resolved_str))
            } else {
                None
            }
        }
        AnalysisLanguage::Go => {
            // Handle relative imports
            if import_specifier.starts_with('.') {
                let resolved = importing_dir.join(import_specifier.trim_matches('"'));
                resolved.to_str().map(|s| s.to_string())
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_language() {
        assert_eq!(AnalysisLanguage::from_path("src/main.rs"), Some(AnalysisLanguage::Rust));
        assert_eq!(AnalysisLanguage::from_path("src/App.tsx"), Some(AnalysisLanguage::TypeScript));
        assert_eq!(AnalysisLanguage::from_path("lib/utils.js"), Some(AnalysisLanguage::JavaScript));
        assert_eq!(AnalysisLanguage::from_path("main.py"), Some(AnalysisLanguage::Python));
        assert_eq!(AnalysisLanguage::from_path("main.go"), Some(AnalysisLanguage::Go));
        assert_eq!(AnalysisLanguage::from_path("README.md"), None);
    }

    #[test]
    fn test_extract_typescript_imports() {
        let code = r#"
            import { useState } from 'react';
            import type { User } from './types';
            import Button from '../components/Button';
        "#;

        let imports = extract_imports("src/App.tsx", code).unwrap();
        assert!(imports.contains(&"./types".to_string()));
        assert!(imports.contains(&"../components/Button".to_string()));
        // External imports like 'react' should be filtered out
        assert!(!imports.iter().any(|i| i.contains("react")));
    }

    #[test]
    fn test_extract_rust_imports() {
        let code = r#"
            use std::collections::HashMap;
            use crate::models::User;
            use super::utils;
        "#;

        let imports = extract_imports("src/main.rs", code).unwrap();
        assert!(imports.iter().any(|i| i.contains("crate::models")));
        assert!(imports.iter().any(|i| i.contains("super::utils")));
    }

    #[test]
    fn test_extract_python_imports() {
        let code = r#"
import os
from .models import User
from ..utils import helper
        "#;

        let imports = extract_imports("src/views.py", code).unwrap();
        assert!(imports.iter().any(|i| i.starts_with('.')));
    }
}
