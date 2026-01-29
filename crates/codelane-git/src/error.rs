//! Git error types

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Not a git repository")]
    NotARepository,

    #[error("Git error: {0}")]
    Git(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
