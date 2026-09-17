pub const MAX_CHUNK_BYTES: usize = 64 * 1024 * 1024;

/// Describes one indexed triangle mesh in a shared little-endian source buffer.
///
/// Attribute offsets are bytes from the start of the source. Positions are XYZ
/// `f32` components, normals are XYZ `i16` components, and indices are part-local
/// `u32` vertex indices. See [`crate::prepare_geometry`] for validation requirements.
#[derive(Clone, Copy, Debug)]
pub struct Part {
    pub id: u32,
    pub positions: usize,
    pub normals: usize,
    pub indices: usize,
    pub vertex_count: usize,
    pub index_count: usize,
}

#[derive(Debug)]
pub struct PreparedGeometry {
    pub positions: Vec<f32>,
    pub normals: Vec<i16>,
    pub indices: Vec<u32>,
    pub part_indices: Vec<f32>,
    pub bounds: Vec<f32>,
}
