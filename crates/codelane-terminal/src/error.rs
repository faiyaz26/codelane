//! Terminal error types

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("PTY error: {0}")]
    Pty(String),

    #[error("Terminal not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
