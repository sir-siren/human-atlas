#![forbid(unsafe_code)]

use atlas_core::{Part, PreparedGeometry, prepare_geometry};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct PackedGeometry(PreparedGeometry);

#[wasm_bindgen]
impl PackedGeometry {
    pub fn positions(&self) -> Vec<f32> {
        self.0.positions.clone()
    }
    pub fn normals(&self) -> Vec<i16> {
        self.0.normals.clone()
    }
    pub fn indices(&self) -> Vec<u32> {
        self.0.indices.clone()
    }
    pub fn part_indices(&self) -> Vec<f32> {
        self.0.part_indices.clone()
    }
    pub fn bounds(&self) -> Vec<f32> {
        self.0.bounds.clone()
    }
}

/// Packs a chunk using six-word descriptor rows without modifying the inputs.
///
/// Each row contains the stable ID, position/normal/index byte offsets, and
/// vertex/index counts, in that order. Attribute formats, units and output order
/// follow [`prepare_geometry`]. Getters return copies of the packed buffers.
///
/// # Errors
///
/// Returns a JavaScript string error for incomplete rows, descriptor allocation
/// failure, or any validation or allocation error from [`prepare_geometry`].
#[wasm_bindgen]
pub fn prepare_chunk(source: &[u8], descriptors: &[u32]) -> Result<PackedGeometry, JsValue> {
    let parts = parse_parts(descriptors).map_err(JsValue::from_str)?;
    prepare_geometry(source, &parts)
        .map(PackedGeometry)
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

fn parse_parts(descriptors: &[u32]) -> Result<Vec<Part>, &'static str> {
    let (rows, remainder) = descriptors.as_chunks::<6>();
    if !remainder.is_empty() {
        return Err("Invalid anatomy descriptor schema.");
    }
    let mut parts = Vec::new();
    parts
        .try_reserve_exact(rows.len())
        .map_err(|_| "An anatomy descriptor allocation failed.")?;
    parts.extend(rows.iter().map(|row| Part {
        id: row[0],
        positions: row[1] as usize,
        normals: row[2] as usize,
        indices: row[3] as usize,
        vertex_count: row[4] as usize,
        index_count: row[5] as usize,
    }));
    Ok(parts)
}

#[cfg(test)]
mod tests {
    use super::parse_parts;

    #[test]
    fn decodes_descriptor_rows_in_order() {
        let parts = parse_parts(&[23, 0, 36, 56, 3, 3, 4, 68, 104, 124, 6, 9]).unwrap();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0].id, 23);
        let second = parts[1];
        assert_eq!(second.id, 4);
        assert_eq!(second.positions, 68);
        assert_eq!(second.normals, 104);
        assert_eq!(second.indices, 124);
        assert_eq!(second.vertex_count, 6);
        assert_eq!(second.index_count, 9);
    }

    #[test]
    fn rejects_incomplete_descriptor_rows() {
        for length in [1, 2, 3, 4, 5, 7, 8, 9, 10, 11] {
            assert_eq!(
                parse_parts(&[0; 11][..length]).unwrap_err(),
                "Invalid anatomy descriptor schema."
            );
        }
        assert!(parse_parts(&[]).unwrap().is_empty());
    }
}
