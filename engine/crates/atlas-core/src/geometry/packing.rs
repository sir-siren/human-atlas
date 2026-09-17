use super::validate::validate;
use crate::{GeometryError, Part, PreparedGeometry};

/// Packs little-endian geometry into owned buffers in descriptor order.
///
/// Positions retain their source units and coordinate frame. Normals retain their
/// signed 16-bit values. Indices are rebased from each part's zero-based vertices;
/// bounds contain `[min_x, min_y, min_z, max_x, max_y, max_z]` for each part.
/// Source ranges may overlap. An empty descriptor list produces empty buffers.
/// Inputs are not mutated.
///
/// # Errors
///
/// - [`GeometryError::InvalidSize`]: source exceeds [`crate::MAX_CHUNK_BYTES`],
///   there are more than 65,536 parts, counts overflow, or packed attributes and
///   bounds exceed twice that byte limit. This is not a total process memory limit.
/// - [`GeometryError::InvalidPart`]: IDs are duplicated or exceed 16,777,216,
///   counts are zero, or index counts are not multiples of three.
/// - [`GeometryError::InvalidRange`]: an attribute byte offset is not aligned to
///   its element width, or its range overflows or extends past the source.
/// - [`GeometryError::InvalidPosition`]: a position is NaN or infinite.
/// - [`GeometryError::InvalidIndex`]: an index is outside its part's vertices.
/// - [`GeometryError::AllocationFailed`]: validation or output storage cannot be reserved.
///
/// No partial output is returned on error.
pub fn prepare_geometry(source: &[u8], parts: &[Part]) -> Result<PreparedGeometry, GeometryError> {
    let (vertices, indices) = validate(source, parts)?;
    let mut output = PreparedGeometry {
        positions: reserved_buffer(vertices * 3)?,
        normals: reserved_buffer(vertices * 3)?,
        indices: reserved_buffer(indices)?,
        part_indices: reserved_buffer(vertices)?,
        bounds: reserved_buffer(parts.len() * 6)?,
    };
    let mut vertex_offset = 0u32;
    for part in parts {
        let mut min = [f32::INFINITY; 3];
        let mut max = [f32::NEG_INFINITY; 3];
        for component in 0..part.vertex_count * 3 {
            let offset = part.positions + component * 4;
            let position = f32::from_le_bytes(
                source[offset..offset + 4]
                    .try_into()
                    .map_err(|_| GeometryError::InvalidRange)?,
            );
            if !position.is_finite() {
                return Err(GeometryError::InvalidPosition);
            }
            min[component % 3] = min[component % 3].min(position);
            max[component % 3] = max[component % 3].max(position);
            output.positions.push(position);
            let offset = part.normals + component * 2;
            output.normals.push(i16::from_le_bytes(
                source[offset..offset + 2]
                    .try_into()
                    .map_err(|_| GeometryError::InvalidRange)?,
            ));
        }
        for triangle_index in 0..part.index_count {
            let offset = part.indices + triangle_index * 4;
            let index = u32::from_le_bytes(
                source[offset..offset + 4]
                    .try_into()
                    .map_err(|_| GeometryError::InvalidRange)?,
            );
            if index as usize >= part.vertex_count {
                return Err(GeometryError::InvalidIndex);
            }
            output.indices.push(index + vertex_offset);
        }
        output
            .part_indices
            .extend(std::iter::repeat_n(part.id as f32, part.vertex_count));
        output.bounds.extend(min);
        output.bounds.extend(max);
        vertex_offset += part.vertex_count as u32;
    }
    Ok(output)
}

fn reserved_buffer<T>(capacity: usize) -> Result<Vec<T>, GeometryError> {
    let mut buffer = Vec::new();
    buffer
        .try_reserve_exact(capacity)
        .map_err(|_| GeometryError::AllocationFailed)?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::reserved_buffer;
    use crate::GeometryError;

    #[test]
    fn reports_unrepresentable_allocation_without_panicking() {
        assert_eq!(
            reserved_buffer::<u32>(usize::MAX),
            Err(GeometryError::AllocationFailed)
        );
    }

    #[test]
    fn reserves_storage_without_initializing_elements() {
        let buffer = reserved_buffer::<i16>(9).unwrap();
        assert!(buffer.is_empty());
        assert!(buffer.capacity() >= 9);
        assert_eq!(reserved_buffer::<i16>(0).unwrap().capacity(), 0);
    }
}
