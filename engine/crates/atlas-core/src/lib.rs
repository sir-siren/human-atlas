//! Packs anatomy geometry without browser dependencies.
//!
//! Start with [`prepare_geometry`] and byte-offset [`Part`] descriptors.
//! This crate has no optional features.
//!
//! ```rust
//! let geometry = atlas_core::prepare_geometry(&[], &[])?;
//! assert!(geometry.positions.is_empty());
//! # Ok::<(), atlas_core::GeometryError>(())
//! ```

#![forbid(unsafe_code)]

mod error;
mod geometry;
mod types;

pub use error::GeometryError;
pub use geometry::prepare_geometry;
pub use types::{MAX_CHUNK_BYTES, Part, PreparedGeometry};
