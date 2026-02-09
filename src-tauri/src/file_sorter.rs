//! Smart file sorting for code review
//!
//! Implements heuristic-based file categorization and ordering to improve
//! code review efficiency by showing files in logical dependency order.

use regex::Regex;
use serde::Serialize;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::OnceLock;

use crate::git::FileChangeStats;
use crate::dependency_graph;

/// File category tier for smart sorting
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileTier {
    /// Tier 0: Project configuration (package.json, Cargo.toml, CI configs)
    ProjectConfig = 0,
    /// Tier 1: Type definitions and interfaces
    TypeDefinitions = 1,
    /// Tier 2: Implementation files (core logic)
    Implementation = 2,
    /// Tier 3: Test files
    Tests = 3,
    /// Tier 4: Generated and lock files
    Generated = 4,
    /// Tier 5: Documentation
    Documentation = 5,
}

/// File category with tier and label
#[derive(Debug, Clone, Serialize)]
pub struct FileCategory {
    pub tier: FileTier,
    pub label: String,
}

/// Patterns for categorizing files
struct CategoryPatterns {
    project_config: Vec<Regex>,
    type_definitions: Vec<Regex>,
    tests: Vec<Regex>,
    generated: Vec<Regex>,
    documentation: Vec<Regex>,
}

static PATTERNS: OnceLock<CategoryPatterns> = OnceLock::new();

fn patterns() -> &'static CategoryPatterns {
    PATTERNS.get_or_init(|| CategoryPatterns {
        project_config: vec![
            // Package manifests
            Regex::new(r"^(package\.json|Cargo\.toml|pyproject\.toml|go\.mod|pom\.xml|build\.gradle|composer\.json)$").unwrap(),
            // Build configs
            Regex::new(r"^(Makefile|CMakeLists\.txt|meson\.build|BUILD|WORKSPACE)$").unwrap(),
            // CI/CD
            Regex::new(r"^\.github/workflows/").unwrap(),
            Regex::new(r"^(\.gitlab-ci\.yml|\.circleci/|\.travis\.yml|azure-pipelines\.yml)").unwrap(),
            // Build tool configs
            Regex::new(r"^(tsconfig|vite\.config|webpack\.config|rollup\.config|tailwind\.config|postcss\.config|jest\.config|vitest\.config)\.(json|ts|js|mjs)$").unwrap(),
            // Linter/formatter configs
            Regex::new(r"^(\.eslintrc|\.prettierrc|rustfmt\.toml|\.rubocop\.yml|pylintrc)").unwrap(),
        ],
        type_definitions: vec![
            // TypeScript definitions
            Regex::new(r"\.d\.ts$").unwrap(),
            // C/C++ headers
            Regex::new(r"\.(h|hpp|hxx|hh)$").unwrap(),
            // Type/interface/model directories
            Regex::new(r"/(types|interfaces|models|schemas?|dtos?)/").unwrap(),
            // Type files
            Regex::new(r"/(types|interfaces)\.(ts|tsx|rs|py|go)$").unwrap(),
            // Protocol definitions
            Regex::new(r"\.(proto|graphql|thrift|avsc)$").unwrap(),
            // OpenAPI/Swagger
            Regex::new(r"(openapi|swagger)\.(yaml|yml|json)$").unwrap(),
        ],
        tests: vec![
            // Test file patterns
            Regex::new(r"\.(test|spec)\.(ts|tsx|js|jsx|rs|py|go|rb|java|kt)$").unwrap(),
            Regex::new(r"_(test|spec)\.(ts|tsx|js|jsx|rs|py|go|rb)$").unwrap(),
            // Test directories
            Regex::new(r"^__tests__/").unwrap(),
            Regex::new(r"^(tests?|specs?)/").unwrap(),
            Regex::new(r"/tests?/").unwrap(),
            Regex::new(r"/specs?/").unwrap(),
            // Specific test patterns
            Regex::new(r"Test\.(java|kt|swift)$").unwrap(),
            Regex::new(r"Tests\.(swift|cs)$").unwrap(),
        ],
        generated: vec![
            // Generated file markers
            Regex::new(r"\.(generated|auto|pb)\.(ts|js|go|rs|py)$").unwrap(),
            // Lock files
            Regex::new(r"^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock)$").unwrap(),
            // Vendored/dependencies
            Regex::new(r"^(vendor|node_modules|dist|build|target|out)/").unwrap(),
            // Protobuf generated
            Regex::new(r"\.pb\.(go|rs|py)$").unwrap(),
            // GraphQL generated
            Regex::new(r"(generated|__generated__)/.*\.(ts|tsx)$").unwrap(),
        ],
        documentation: vec![
            // Markdown
            Regex::new(r"\.(md|mdx|txt|rst|adoc)$").unwrap(),
            // Common doc files
            Regex::new(r"^(README|CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT|AUTHORS)").unwrap(),
            // Doc directories
            Regex::new(r"^(docs?|documentation)/").unwrap(),
        ],
    })
}

/// Categorize a file by path
pub fn categorize_file(path: &str) -> FileCategory {
    let patterns = patterns();

    // Check specific categories first (skip implementation tier)
    if patterns.project_config.iter().any(|re| re.is_match(path)) {
        return FileCategory {
            tier: FileTier::ProjectConfig,
            label: "Project Configuration".to_string(),
        };
    }

    if patterns.type_definitions.iter().any(|re| re.is_match(path)) {
        return FileCategory {
            tier: FileTier::TypeDefinitions,
            label: "Type Definitions".to_string(),
        };
    }

    if patterns.tests.iter().any(|re| re.is_match(path)) {
        return FileCategory {
            tier: FileTier::Tests,
            label: "Tests".to_string(),
        };
    }

    if patterns.generated.iter().any(|re| re.is_match(path)) {
        return FileCategory {
            tier: FileTier::Generated,
            label: "Generated Files".to_string(),
        };
    }

    if patterns.documentation.iter().any(|re| re.is_match(path)) {
        return FileCategory {
            tier: FileTier::Documentation,
            label: "Documentation".to_string(),
        };
    }

    // Default to implementation
    FileCategory {
        tier: FileTier::Implementation,
        label: "Implementation".to_string(),
    }
}

/// Find matching test file for an implementation file
fn find_matching_test<'a>(impl_path: &str, test_files: &[&'a FileChangeStats]) -> Option<&'a FileChangeStats> {
    // Remove extension from implementation file
    let base_name = impl_path
        .trim_end_matches(".ts")
        .trim_end_matches(".tsx")
        .trim_end_matches(".js")
        .trim_end_matches(".jsx")
        .trim_end_matches(".rs")
        .trim_end_matches(".py")
        .trim_end_matches(".go")
        .trim_end_matches(".java")
        .trim_end_matches(".kt")
        .trim_end_matches(".rb");

    // Try to find matching test
    test_files.iter().find(|test_file| {
        let test_base = test_file.path
            .trim_end_matches(".test.ts")
            .trim_end_matches(".test.tsx")
            .trim_end_matches(".test.js")
            .trim_end_matches(".test.jsx")
            .trim_end_matches(".spec.ts")
            .trim_end_matches(".spec.tsx")
            .trim_end_matches(".spec.js")
            .trim_end_matches(".spec.jsx")
            .trim_end_matches("_test.rs")
            .trim_end_matches("_test.py")
            .trim_end_matches("_test.go")
            .trim_end_matches("_spec.rb")
            .trim_end_matches("Test.java")
            .trim_end_matches("Test.kt")
            .trim_end_matches("Tests.swift");

        test_base == base_name || test_base.ends_with(&format!("/{}", base_name.split('/').last().unwrap_or("")))
    }).copied()
}

/// Sort files using smart heuristic-based ordering
pub fn sort_files_smart(files: Vec<FileChangeStats>) -> Vec<FileChangeStats> {
    // Step 1: Categorize all files
    let mut categorized: Vec<(FileChangeStats, FileCategory)> = files
        .into_iter()
        .map(|f| {
            let category = categorize_file(&f.path);
            (f, category)
        })
        .collect();

    // Step 2: Sort by tier, then by diff size within tier, then alphabetically
    categorized.sort_by(|a, b| {
        // Primary: tier
        match a.1.tier.cmp(&b.1.tier) {
            Ordering::Equal => {
                // Secondary: diff size (descending) - show larger changes first
                let size_a = a.0.additions + a.0.deletions;
                let size_b = b.0.additions + b.0.deletions;
                match size_b.cmp(&size_a) {
                    Ordering::Equal => {
                        // Tertiary: alphabetical
                        a.0.path.cmp(&b.0.path)
                    }
                    other => other,
                }
            }
            other => other,
        }
    });

    // Step 3: Pair test files with their implementation files
    let mut result = Vec::new();
    let test_files: Vec<&FileChangeStats> = categorized
        .iter()
        .filter(|(_, cat)| cat.tier == FileTier::Tests)
        .map(|(f, _)| f)
        .collect();

    let mut paired_tests = std::collections::HashSet::new();

    for (file, category) in &categorized {
        // Skip test files here - they'll be added when paired
        if category.tier == FileTier::Tests {
            continue;
        }

        result.push(file.clone());

        // If this is an implementation file, try to find and pair its test
        if category.tier == FileTier::Implementation {
            if let Some(test_file) = find_matching_test(&file.path, &test_files) {
                if !paired_tests.contains(&test_file.path) {
                    result.push(test_file.clone());
                    paired_tests.insert(test_file.path.clone());
                }
            }
        }
    }

    // Add any unpaired test files at the end of the test section
    for (file, category) in &categorized {
        if category.tier == FileTier::Tests && !paired_tests.contains(&file.path) {
            result.push(file.clone());
        }
    }

    result
}

/// Sort files alphabetically by path
pub fn sort_files_alphabetical(mut files: Vec<FileChangeStats>) -> Vec<FileChangeStats> {
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files
}

/// Sort files by change size (largest first)
pub fn sort_files_by_size(mut files: Vec<FileChangeStats>) -> Vec<FileChangeStats> {
    files.sort_by(|a, b| {
        let size_a = a.additions + a.deletions;
        let size_b = b.additions + b.deletions;
        // Descending order
        size_b.cmp(&size_a)
    });
    files
}

/// Sort files with dependency awareness using tree-sitter
/// Combines smart tier-based sorting with topological ordering within tiers
pub fn sort_files_smart_dependencies(
    files: Vec<FileChangeStats>,
    file_contents: HashMap<String, String>,
) -> Vec<FileChangeStats> {
    // Step 1: Categorize all files into tiers (same as smart sort)
    let mut categorized: Vec<(FileChangeStats, FileCategory)> = files
        .into_iter()
        .map(|f| {
            let category = categorize_file(&f.path);
            (f, category)
        })
        .collect();

    // Step 2: Group by tier
    let mut tiers = HashMap::<FileTier, Vec<FileChangeStats>>::new();
    for (file, category) in categorized {
        tiers.entry(category.tier).or_insert_with(Vec::new).push(file);
    }

    // Step 3: Sort each tier independently
    let mut result = Vec::new();

    // Process tiers in order
    for tier_id in [
        FileTier::ProjectConfig,
        FileTier::TypeDefinitions,
        FileTier::Implementation,
        FileTier::Tests,
        FileTier::Generated,
        FileTier::Documentation,
    ] {
        if let Some(mut tier_files) = tiers.remove(&tier_id) {
            // For Implementation tier, apply dependency sorting
            if tier_id == FileTier::Implementation && tier_files.len() > 1 {
                tier_files = dependency_graph::sort_by_dependencies(tier_files, &file_contents);
            } else {
                // For other tiers, sort by size then alphabetically
                tier_files.sort_by(|a, b| {
                    let size_a = a.additions + a.deletions;
                    let size_b = b.additions + b.deletions;
                    match size_b.cmp(&size_a) {
                        Ordering::Equal => a.path.cmp(&b.path),
                        other => other,
                    }
                });
            }

            // Add tier files to result
            for file in &tier_files {
                result.push(file.clone());

                // If this is an implementation file, try to pair its test
                if tier_id == FileTier::Implementation {
                    if let Some(test_tier) = tiers.get_mut(&FileTier::Tests) {
                        let test_refs: Vec<&FileChangeStats> = test_tier.iter().collect();
                        if let Some(test_file) = find_matching_test(&file.path, &test_refs) {
                            let test_path = test_file.path.clone();
                            result.push(test_file.clone());
                            // Remove from test tier so we don't add it again
                            test_tier.retain(|f| f.path != test_path);
                        }
                    }
                }
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_categorize_project_config() {
        assert_eq!(categorize_file("package.json").tier, FileTier::ProjectConfig);
        assert_eq!(categorize_file("Cargo.toml").tier, FileTier::ProjectConfig);
        assert_eq!(categorize_file(".github/workflows/ci.yml").tier, FileTier::ProjectConfig);
        assert_eq!(categorize_file("tsconfig.json").tier, FileTier::ProjectConfig);
    }

    #[test]
    fn test_categorize_type_definitions() {
        assert_eq!(categorize_file("src/types.d.ts").tier, FileTier::TypeDefinitions);
        assert_eq!(categorize_file("include/header.h").tier, FileTier::TypeDefinitions);
        assert_eq!(categorize_file("src/types/user.ts").tier, FileTier::TypeDefinitions);
        assert_eq!(categorize_file("schema.proto").tier, FileTier::TypeDefinitions);
    }

    #[test]
    fn test_categorize_tests() {
        assert_eq!(categorize_file("src/app.test.ts").tier, FileTier::Tests);
        assert_eq!(categorize_file("src/app.spec.tsx").tier, FileTier::Tests);
        assert_eq!(categorize_file("tests/integration_test.rs").tier, FileTier::Tests);
        assert_eq!(categorize_file("__tests__/component.test.js").tier, FileTier::Tests);
    }

    #[test]
    fn test_categorize_implementation() {
        assert_eq!(categorize_file("src/main.rs").tier, FileTier::Implementation);
        assert_eq!(categorize_file("lib/utils.ts").tier, FileTier::Implementation);
        assert_eq!(categorize_file("app/components/Button.tsx").tier, FileTier::Implementation);
    }

    #[test]
    fn test_categorize_generated() {
        assert_eq!(categorize_file("package-lock.json").tier, FileTier::Generated);
        assert_eq!(categorize_file("Cargo.lock").tier, FileTier::Generated);
        assert_eq!(categorize_file("src/proto.pb.go").tier, FileTier::Generated);
        assert_eq!(categorize_file("vendor/lib.rs").tier, FileTier::Generated);
    }

    #[test]
    fn test_categorize_documentation() {
        assert_eq!(categorize_file("README.md").tier, FileTier::Documentation);
        assert_eq!(categorize_file("CHANGELOG.md").tier, FileTier::Documentation);
        assert_eq!(categorize_file("docs/guide.md").tier, FileTier::Documentation);
    }
}
