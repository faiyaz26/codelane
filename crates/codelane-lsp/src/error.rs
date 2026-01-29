//! LSP error types

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Language server not found: {0}")]
    ServerNotFound(String),

    #[error("Language server failed to start: {0}")]
    StartFailed(String),

    #[error("LSP protocol error: {0}")]
    Protocol(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
