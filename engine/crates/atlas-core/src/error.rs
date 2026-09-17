use std::fmt;

/// Reports invalid geometry input or failure to reserve packing storage.
///
/// See [`crate::prepare_geometry`] for the conditions that produce each variant.
#[derive(Debug, PartialEq, Eq)]
pub enum GeometryError {
    InvalidSize,
    InvalidPart,
    InvalidRange,
    InvalidPosition,
    InvalidIndex,
    AllocationFailed,
}

impl fmt::Display for GeometryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::InvalidSize => "An anatomy chunk exceeds the supported byte budget.",
            Self::InvalidPart => "An anatomy part has invalid counts or identity.",
            Self::InvalidRange => "An anatomy attribute has an invalid buffer range.",
            Self::InvalidPosition => "An anatomy position is not finite.",
            Self::InvalidIndex => "An anatomy triangle index is outside its part.",
            Self::AllocationFailed => "An anatomy buffer allocation failed.",
        })
    }
}

impl std::error::Error for GeometryError {}
