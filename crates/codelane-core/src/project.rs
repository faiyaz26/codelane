//! Project abstraction for detecting project types and configurations

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Detected project type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectType {
    Rust,
    Node,
    Python,
    Go,
    Java,
    CSharp,
    Ruby,
    Php,
    Unknown,
}

impl ProjectType {
    /// Detect project type from directory contents
    pub fn detect(path: &Path) -> Self {
        if path.join("Cargo.toml").exists() {
            ProjectType::Rust
        } else if path.join("package.json").exists() {
            ProjectType::Node
        } else if path.join("pyproject.toml").exists()
            || path.join("setup.py").exists()
            || path.join("requirements.txt").exists()
        {
            ProjectType::Python
        } else if path.join("go.mod").exists() {
            ProjectType::Go
        } else if path.join("pom.xml").exists() || path.join("build.gradle").exists() {
            ProjectType::Java
        } else if path.join("*.csproj").exists() || path.join("*.sln").exists() {
            ProjectType::CSharp
        } else if path.join("Gemfile").exists() {
            ProjectType::Ruby
        } else if path.join("composer.json").exists() {
            ProjectType::Php
        } else {
            ProjectType::Unknown
        }
    }

    /// Get recommended LSP servers for this project type
    pub fn recommended_lsp_servers(&self) -> Vec<&'static str> {
        match self {
            ProjectType::Rust => vec!["rust-analyzer"],
            ProjectType::Node => vec!["typescript-language-server"],
            ProjectType::Python => vec!["pyright", "ruff-lsp"],
            ProjectType::Go => vec!["gopls"],
            ProjectType::Java => vec!["jdtls"],
            ProjectType::CSharp => vec!["omnisharp"],
            ProjectType::Ruby => vec!["solargraph"],
            ProjectType::Php => vec!["intelephense"],
            ProjectType::Unknown => vec![],
        }
    }

    /// Get file extensions associated with this project type
    pub fn extensions(&self) -> Vec<&'static str> {
        match self {
            ProjectType::Rust => vec!["rs"],
            ProjectType::Node => vec!["js", "ts", "jsx", "tsx", "mjs", "cjs"],
            ProjectType::Python => vec!["py", "pyi"],
            ProjectType::Go => vec!["go"],
            ProjectType::Java => vec!["java"],
            ProjectType::CSharp => vec!["cs"],
            ProjectType::Ruby => vec!["rb"],
            ProjectType::Php => vec!["php"],
            ProjectType::Unknown => vec![],
        }
    }
}

/// Project metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    /// Root directory
    pub root: PathBuf,

    /// Detected project type
    pub project_type: ProjectType,

    /// Project name (from config file or directory name)
    pub name: String,

    /// Git repository root (if different from project root)
    pub git_root: Option<PathBuf>,
}

impl Project {
    /// Discover project from a path
    pub fn discover(path: &Path) -> Option<Self> {
        let root = Self::find_root(path)?;
        let project_type = ProjectType::detect(&root);
        let name = Self::detect_name(&root, project_type);
        let git_root = Self::find_git_root(&root);

        Some(Self {
            root,
            project_type,
            name,
            git_root,
        })
    }

    /// Find the project root by walking up from the given path
    fn find_root(path: &Path) -> Option<PathBuf> {
        let mut current = if path.is_file() {
            path.parent()?.to_path_buf()
        } else {
            path.to_path_buf()
        };

        loop {
            // Check for common project markers
            let markers = [
                "Cargo.toml",
                "package.json",
                "pyproject.toml",
                "go.mod",
                "pom.xml",
                ".git",
            ];

            for marker in markers {
                if current.join(marker).exists() {
                    return Some(current);
                }
            }

            // Move up
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }

    /// Detect project name from configuration files
    fn detect_name(root: &Path, project_type: ProjectType) -> String {
        match project_type {
            ProjectType::Rust => {
                if let Ok(content) = std::fs::read_to_string(root.join("Cargo.toml")) {
                    if let Ok(cargo) = content.parse::<toml::Table>() {
                        if let Some(package) = cargo.get("package").and_then(|p| p.as_table()) {
                            if let Some(name) = package.get("name").and_then(|n| n.as_str()) {
                                return name.to_string();
                            }
                        }
                    }
                }
            }
            ProjectType::Node => {
                if let Ok(content) = std::fs::read_to_string(root.join("package.json")) {
                    if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(name) = pkg.get("name").and_then(|n| n.as_str()) {
                            return name.to_string();
                        }
                    }
                }
            }
            _ => {}
        }

        // Fall back to directory name
        root.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed")
            .to_string()
    }

    /// Find git repository root
    fn find_git_root(path: &Path) -> Option<PathBuf> {
        let mut current = path.to_path_buf();

        loop {
            if current.join(".git").exists() {
                return Some(current);
            }

            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }
}
