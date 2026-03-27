//! Git repository operations

use std::path::{Path, PathBuf};
use gix::bstr::ByteSlice;

use crate::{Error, Result};
use crate::diff::compute_diff;

/// Git repository wrapper
pub struct Repository {
    repo: gix::Repository,
    root: PathBuf,
}

impl Repository {
    /// Open a repository at the given path
    pub fn open(path: &Path) -> Result<Self> {
        let repo = gix::open(path).map_err(|e| Error::Git(e.to_string()))?;
        let root = repo
            .work_dir()
            .ok_or_else(|| Error::Git("Bare repository not supported".into()))?
            .to_path_buf();

        Ok(Self { repo, root })
    }

    /// Discover repository from a path (walks up directories)
    pub fn discover(path: &Path) -> Result<Self> {
        let repo = gix::discover(path).map_err(|e| Error::Git(e.to_string()))?;
        let root = repo
            .work_dir()
            .ok_or_else(|| Error::Git("Bare repository not supported".into()))?
            .to_path_buf();

        Ok(Self { repo, root })
    }

    /// Get the repository root
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Get the current branch name
    pub fn current_branch(&self) -> Result<Option<String>> {
        let head = self.repo.head().map_err(|e| Error::Git(e.to_string()))?;

        if let Some(reference) = head.try_into_referent() {
            let name = reference.name().shorten().to_string();
            Ok(Some(name))
        } else {
            // Detached HEAD
            Ok(None)
        }
    }

    /// Get the current commit hash
    pub fn head_commit(&self) -> Result<String> {
        let mut head = self.repo.head().map_err(|e| Error::Git(e.to_string()))?;
        let commit = head
            .peel_to_commit_in_place()
            .map_err(|e| Error::Git(e.to_string()))?;
        Ok(commit.id().to_string())
    }

    /// Get the current repository status
    pub fn status(&self) -> Result<crate::status::StatusSummary> {
        crate::status::StatusSummary::fetch(&self.repo)
    }

    /// Get the diff for the repository
    pub fn diff(&self, file: Option<&str>, staged: bool) -> Result<String> {
        compute_diff(&self.repo, file, staged)
    }

    /// Get the commit log
    pub fn log(&self, count: usize) -> Result<Vec<crate::status::GitCommit>> {
        let head = self.repo.head().map_err(|e| Error::Git(e.to_string()))?;
        let commit_id = head.id().ok_or_else(|| Error::Git("No HEAD commit found".into()))?;
        
        let mut commits = Vec::new();
        let walk = commit_id.ancestors().all().map_err(|e| Error::Git(e.to_string()))?;
        
        for info in walk.take(count) {
            let info = info.map_err(|e| Error::Git(e.to_string()))?;
            let commit = self.repo.find_object(info.id).map_err(|e| Error::Git(e.to_string()))?.try_into_commit().map_err(|e| Error::Git(e.to_string()))?;
            let author = commit.author().map_err(|e| Error::Git(e.to_string()))?;
            let message = commit.message().map_err(|e| Error::Git(e.to_string()))?;
            
            commits.push(crate::status::GitCommit {
                hash: commit.id().to_string(),
                short_hash: commit.id().to_string()[..7].to_string(),
                message: message.summary().to_string(),
                author: author.name.to_string(),
                date: commit.time().expect("time exists").seconds.to_string(), // Simplified timestamp
            });
        }
        
        Ok(commits)
    }

    /// Get all local branches
    pub fn branches(&self) -> Result<Vec<String>> {
        let mut branches = Vec::new();
        let refs = self.repo.references().map_err(|e| Error::Git(e.to_string()))?;
        for branch in refs.local_branches().map_err(|e| Error::Git(e.to_string()))? {
            let branch = branch.map_err(|e| Error::Git(e.to_string()))?;
            branches.push(branch.name().shorten().to_string());
        }
        branches.sort();
        Ok(branches)
    }

    /// Get changes with statistics (additions/deletions)
    pub fn changes_with_stats(&self) -> Result<Vec<crate::status::FileChangeStats>> {
        // For now, return an error to trigger CLI fallback as numstat diff is complex in gix
        Err(Error::Git("Native gix changes_with_stats not yet implemented".to_string()))
    }

    /// Get changes in a specific commit with statistics
    pub fn commit_changes(&self, _hash: &str) -> Result<Vec<crate::status::FileChangeStats>> {
        Err(Error::Git("Native gix commit_changes not yet implemented".to_string()))
    }

    /// Get the default branch name (main or master)
    pub fn default_branch(&self) -> Result<String> {
        // Try origin/HEAD first
        if let Ok(origin_head) = self.repo.find_reference("origin/HEAD") {
            if let Some(target) = origin_head.target().try_name() {
                let shortened = target.shorten().to_string();
                // shorten() yields "origin/main" for refs/remotes/origin/main;
                // strip the remote prefix to get just the branch name.
                let branch_name = shortened
                    .find('/')
                    .map(|pos| shortened[pos + 1..].to_string())
                    .unwrap_or(shortened);
                if !branch_name.is_empty() {
                    return Ok(branch_name);
                }
            }
        }

        // Try main then master
        if self.repo.find_reference("main").is_ok() {
            return Ok("main".to_string());
        }
        if self.repo.find_reference("master").is_ok() {
            return Ok("master".to_string());
        }

        // Fallback to current branch
        self.current_branch()?.ok_or_else(|| Error::Git("Could not determine default branch".into()))
    }

    /// Get file content at a specific revision
    pub fn show_file(&self, file: &str, revision: &str) -> Result<String> {
        let id = self.repo.rev_parse_single(gix::bstr::BStr::new(revision)).map_err(|e| Error::Git(e.to_string()))?;
        let tree = id.object().map_err(|e| Error::Git(e.to_string()))?.try_into_commit().map_err(|e| Error::Git(e.to_string()))?.tree().map_err(|e| Error::Git(e.to_string()))?;
        
        let entry = tree.lookup_entry_by_path(file).map_err(|e| Error::Git(e.to_string()))?
            .ok_or_else(|| Error::Git(format!("File not found: {}", file)))?;
            
        let object = entry.object().map_err(|e| Error::Git(e.to_string()))?;
        let blob = object.try_into_blob().map_err(|e| Error::Git(e.to_string()))?;
        
        Ok(blob.data.as_bstr().to_string())
    }

    /// Get the remote URL for a given remote name
    pub fn remote_url(&self, name: &str) -> Result<Option<String>> {
        let config = self.repo.config_snapshot();
        let key = format!("remote.{}.url", name);
        let url = config.string(gix::bstr::BStr::new(&key)).map(|s| s.to_string());
        Ok(url)
    }

    /// Check if a path is a git repository
    pub fn is_repo(path: &Path) -> bool {
        gix::discover(path).is_ok()
    }

    /// Initialize a new git repository
    pub fn init(path: &Path) -> Result<Self> {
        let repo = gix::init(path).map_err(|e| Error::Git(e.to_string()))?;
        let root = repo
            .work_dir()
            .ok_or_else(|| Error::Git("Bare repository not supported".into()))?
            .to_path_buf();

        Ok(Self { repo, root })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::TempDir;

    fn create_test_repo() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let path = temp_dir.path();

        Command::new("git")
            .current_dir(path)
            .args(["init"])
            .output()
            .expect("Failed to init git repo");

        Command::new("git")
            .current_dir(path)
            .args(["config", "user.email", "test@test.com"])
            .output()
            .expect("Failed to set git email");

        Command::new("git")
            .current_dir(path)
            .args(["config", "user.name", "Test User"])
            .output()
            .expect("Failed to set git name");

        temp_dir
    }

    #[test]
    fn test_repo_log() {
        let temp = create_test_repo();
        fs::write(temp.path().join("file.txt"), "content").unwrap();

        Command::new("git")
            .current_dir(temp.path())
            .args(["add", "file.txt"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(temp.path())
            .args(["commit", "-m", "initial commit"])
            .output()
            .unwrap();

        let repo = Repository::open(temp.path()).unwrap();
        let log = repo.log(10).unwrap();

        assert_eq!(log.len(), 1);
        assert_eq!(log[0].message, "initial commit");
        assert_eq!(log[0].author, "Test User");
    }

    #[test]
    fn test_repo_branches() {
        let temp = create_test_repo();
        fs::write(temp.path().join("file.txt"), "content").unwrap();

        Command::new("git")
            .current_dir(temp.path())
            .args(["add", "file.txt"])
            .output()
            .unwrap();
        Command::new("git")
            .current_dir(temp.path())
            .args(["commit", "-m", "initial"])
            .output()
            .unwrap();

        Command::new("git")
            .current_dir(temp.path())
            .args(["branch", "feature"])
            .output()
            .unwrap();

        let repo = Repository::open(temp.path()).unwrap();
        let branches = repo.branches().unwrap();

        assert!(branches.contains(&"feature".to_string()));
        // Depending on git version, default branch might be main or master
        assert!(branches.contains(&"main".to_string()) || branches.contains(&"master".to_string()));
    }
}
