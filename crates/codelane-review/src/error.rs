//! Review error types

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Review not found: {0}")]
    NotFound(String),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
