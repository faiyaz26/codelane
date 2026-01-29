//! Error types for Codelane

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Lane not found: {0}")]
    LaneNotFound(String),

    #[error("Terminal not found: {0}")]
    TerminalNotFound(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("TOML error: {0}")]
    Toml(#[from] toml::de::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
