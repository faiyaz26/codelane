//! Git repository operations

use std::path::{Path, PathBuf};

use crate::{Error, Result};

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
}
