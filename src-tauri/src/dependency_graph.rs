//! Dependency graph construction and topological sorting
//!
//! Builds dependency graphs from import relationships and performs
//! topological sorting to order files by their dependencies.

use std::collections::{HashMap, HashSet, VecDeque};
use crate::git::FileChangeStats;
use crate::import_analyzer::{self, AnalysisLanguage};

/// A node in the dependency graph
#[derive(Debug, Clone)]
struct GraphNode {
    file_path: String,
    dependencies: Vec<String>, // Files this node depends on
}

/// Build a dependency graph from changed files
pub fn build_dependency_graph(
    files: &[FileChangeStats],
    file_contents: &HashMap<String, String>,
) -> HashMap<String, Vec<String>> {
    let mut graph: HashMap<String, Vec<String>> = HashMap::new();

    for file in files {
        let dependencies = extract_file_dependencies(&file.path, file_contents);

        // Only keep dependencies that are in the changed files set
        let changed_paths: HashSet<_> = files.iter().map(|f| normalize_path(&f.path)).collect();
        let filtered_deps: Vec<String> = dependencies
            .into_iter()
            .filter(|dep| changed_paths.contains(&normalize_path(dep)))
            .collect();

        graph.insert(file.path.clone(), filtered_deps);
    }

    graph
}

/// Extract dependencies for a single file
fn extract_file_dependencies(
    file_path: &str,
    file_contents: &HashMap<String, String>,
) -> Vec<String> {
    let content = match file_contents.get(file_path) {
        Some(c) => c,
        None => return Vec::new(),
    };

    let language = match AnalysisLanguage::from_path(file_path) {
        Some(lang) => lang,
        None => return Vec::new(),
    };

    // Extract import specifiers
    let import_specifiers = match import_analyzer::extract_imports(file_path, content) {
        Ok(imports) => imports,
        Err(_) => return Vec::new(),
    };

    // Resolve import specifiers to file paths
    let mut dependencies = Vec::new();
    for specifier in import_specifiers {
        if let Some(resolved) = import_analyzer::resolve_import_path(file_path, &specifier, language) {
            dependencies.push(normalize_path(&resolved));
        }
    }

    dependencies
}

/// Normalize a file path for comparison
fn normalize_path(path: &str) -> String {
    path.trim_start_matches("./")
        .trim_start_matches("../")
        .to_string()
}

/// Perform topological sort using Kahn's algorithm
/// Returns sorted files (dependencies first) or None if cycle detected
pub fn topological_sort(
    files: Vec<FileChangeStats>,
    graph: &HashMap<String, Vec<String>>,
) -> Option<Vec<FileChangeStats>> {
    // Build a map for quick lookup
    let file_map: HashMap<String, FileChangeStats> = files
        .iter()
        .map(|f| (f.path.clone(), f.clone()))
        .collect();

    // Calculate in-degree for each node (number of dependencies)
    // In-degree = how many files this file depends on
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    for file in &files {
        let deps_count = graph.get(&file.path).map(|v| v.len()).unwrap_or(0);
        in_degree.insert(file.path.clone(), deps_count);
    }

    // Queue for nodes with in-degree 0
    let mut queue: VecDeque<String> = in_degree
        .iter()
        .filter(|(_, &degree)| degree == 0)
        .map(|(path, _)| path.clone())
        .collect();

    let mut sorted = Vec::new();

    while let Some(node) = queue.pop_front() {
        sorted.push(node.clone());

        // Reduce in-degree for nodes that depend on this node
        // Find all files that list 'node' in their dependencies
        for (file, deps) in graph.iter() {
            if deps.contains(&node) {
                if let Some(degree) = in_degree.get_mut(file) {
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push_back(file.clone());
                    }
                }
            }
        }
    }

    // Check for cycles
    if sorted.len() != files.len() {
        // Cycle detected - cannot complete topological sort
        return None;
    }

    // Convert back to FileChangeStats
    let result: Vec<FileChangeStats> = sorted
        .into_iter()
        .filter_map(|path| file_map.get(&path).cloned())
        .collect();

    Some(result)
}

/// Sort files by dependencies within the same tier
/// Returns sorted files or original order if cycles detected or parsing fails
pub fn sort_by_dependencies(
    files: Vec<FileChangeStats>,
    file_contents: &HashMap<String, String>,
) -> Vec<FileChangeStats> {
    if files.len() <= 1 {
        return files;
    }

    // Try to build dependency graph
    let graph = build_dependency_graph(&files, file_contents);

    // If no dependencies found, return original order
    if graph.values().all(|deps| deps.is_empty()) {
        return files;
    }

    // Attempt topological sort
    match topological_sort(files.clone(), &graph) {
        Some(sorted) => sorted,
        None => {
            // Cycle detected - fall back to original order
            // In a real implementation, we might want to break cycles intelligently
            files
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_file(path: &str) -> FileChangeStats {
        FileChangeStats {
            path: path.to_string(),
            status: "modified".to_string(),
            additions: 10,
            deletions: 5,
        }
    }

    #[test]
    fn test_topological_sort_simple() {
        let files = vec![
            make_file("src/c.ts"),
            make_file("src/a.ts"),
            make_file("src/b.ts"),
        ];

        // a.ts depends on nothing
        // b.ts depends on a.ts
        // c.ts depends on b.ts
        let mut graph = HashMap::new();
        graph.insert("src/a.ts".to_string(), vec![]);
        graph.insert("src/b.ts".to_string(), vec!["src/a.ts".to_string()]);
        graph.insert("src/c.ts".to_string(), vec!["src/b.ts".to_string()]);

        let sorted = topological_sort(files, &graph).unwrap();

        // a should come before b, b should come before c
        let paths: Vec<_> = sorted.iter().map(|f| f.path.as_str()).collect();
        let a_idx = paths.iter().position(|&p| p == "src/a.ts").unwrap();
        let b_idx = paths.iter().position(|&p| p == "src/b.ts").unwrap();
        let c_idx = paths.iter().position(|&p| p == "src/c.ts").unwrap();

        assert!(a_idx < b_idx);
        assert!(b_idx < c_idx);
    }

    #[test]
    fn test_topological_sort_cycle() {
        let files = vec![
            make_file("src/a.ts"),
            make_file("src/b.ts"),
        ];

        // Cycle: a depends on b, b depends on a
        let mut graph = HashMap::new();
        graph.insert("src/a.ts".to_string(), vec!["src/b.ts".to_string()]);
        graph.insert("src/b.ts".to_string(), vec!["src/a.ts".to_string()]);

        let result = topological_sort(files, &graph);
        assert!(result.is_none()); // Should detect cycle
    }

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("./src/main.ts"), "src/main.ts");
        assert_eq!(normalize_path("../utils/helper.ts"), "utils/helper.ts");
        assert_eq!(normalize_path("src/app.ts"), "src/app.ts");
    }

    #[test]
    fn test_topological_sort_empty() {
        let files = vec![];
        let graph = HashMap::new();
        let result = topological_sort(files, &graph).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_topological_sort_no_dependencies() {
        let files = vec![
            make_file("src/a.ts"),
            make_file("src/b.ts"),
            make_file("src/c.ts"),
        ];

        // No dependencies between files
        let mut graph = HashMap::new();
        graph.insert("src/a.ts".to_string(), vec![]);
        graph.insert("src/b.ts".to_string(), vec![]);
        graph.insert("src/c.ts".to_string(), vec![]);

        let result = topological_sort(files, &graph).unwrap();
        assert_eq!(result.len(), 3);
        // Order doesn't matter when there are no dependencies
    }

    #[test]
    fn test_topological_sort_diamond() {
        // Diamond dependency: d depends on b and c, both b and c depend on a
        let files = vec![
            make_file("src/a.ts"),
            make_file("src/b.ts"),
            make_file("src/c.ts"),
            make_file("src/d.ts"),
        ];

        let mut graph = HashMap::new();
        graph.insert("src/a.ts".to_string(), vec![]);
        graph.insert("src/b.ts".to_string(), vec!["src/a.ts".to_string()]);
        graph.insert("src/c.ts".to_string(), vec!["src/a.ts".to_string()]);
        graph.insert("src/d.ts".to_string(), vec!["src/b.ts".to_string(), "src/c.ts".to_string()]);

        let sorted = topological_sort(files, &graph).unwrap();
        let paths: Vec<_> = sorted.iter().map(|f| f.path.as_str()).collect();

        let a_idx = paths.iter().position(|&p| p == "src/a.ts").unwrap();
        let b_idx = paths.iter().position(|&p| p == "src/b.ts").unwrap();
        let c_idx = paths.iter().position(|&p| p == "src/c.ts").unwrap();
        let d_idx = paths.iter().position(|&p| p == "src/d.ts").unwrap();

        // a should come before b and c
        assert!(a_idx < b_idx);
        assert!(a_idx < c_idx);
        // b and c should come before d
        assert!(b_idx < d_idx);
        assert!(c_idx < d_idx);
    }

    #[test]
    fn test_topological_sort_single_file() {
        let files = vec![make_file("src/main.ts")];
        let mut graph = HashMap::new();
        graph.insert("src/main.ts".to_string(), vec![]);

        let result = topological_sort(files, &graph).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "src/main.ts");
    }

    #[test]
    fn test_sort_by_dependencies_empty() {
        let files = vec![];
        let file_contents = HashMap::new();
        let result = sort_by_dependencies(files, &file_contents);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_sort_by_dependencies_single() {
        let files = vec![make_file("src/main.ts")];
        let file_contents = HashMap::new();
        let result = sort_by_dependencies(files.clone(), &file_contents);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, files[0].path);
    }
}
