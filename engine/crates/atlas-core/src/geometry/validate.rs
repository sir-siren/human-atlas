use crate::{GeometryError, MAX_CHUNK_BYTES, Part};
use std::collections::HashSet;

fn range(offset: usize, count: usize, width: usize, len: usize) -> Result<(), GeometryError> {
    if !offset.is_multiple_of(width)
        || offset
            .checked_add(
                count
                    .checked_mul(width)
                    .ok_or(GeometryError::InvalidRange)?,
            )
            .is_none_or(|end| end > len)
    {
        return Err(GeometryError::InvalidRange);
    }
    Ok(())
}

pub(super) fn validate(source: &[u8], parts: &[Part]) -> Result<(usize, usize), GeometryError> {
    if source.len() > MAX_CHUNK_BYTES || parts.len() > 65536 {
        return Err(GeometryError::InvalidSize);
    }
    let mut ids = HashSet::new();
    ids.try_reserve(parts.len())
        .map_err(|_| GeometryError::AllocationFailed)?;
    let (mut vertices, mut indices) = (0usize, 0usize);
    for part in parts {
        if part.id > 16_777_216
            || !ids.insert(part.id)
            || part.vertex_count == 0
            || part.index_count == 0
            || !part.index_count.is_multiple_of(3)
        {
            return Err(GeometryError::InvalidPart);
        }
        let components = part
            .vertex_count
            .checked_mul(3)
            .ok_or(GeometryError::InvalidSize)?;
        range(part.positions, components, 4, source.len())?;
        range(part.normals, components, 2, source.len())?;
        range(part.indices, part.index_count, 4, source.len())?;
        vertices = vertices
            .checked_add(part.vertex_count)
            .ok_or(GeometryError::InvalidSize)?;
        indices = indices
            .checked_add(part.index_count)
            .ok_or(GeometryError::InvalidSize)?;
    }
    let output_bytes = vertices
        .checked_mul(22)
        .and_then(|vertex_bytes| {
            indices
                .checked_mul(4)
                .and_then(|index_bytes| vertex_bytes.checked_add(index_bytes))
        })
        .and_then(|attribute_bytes| {
            parts
                .len()
                .checked_mul(6 * size_of::<f32>())
                .and_then(|bounds_bytes| attribute_bytes.checked_add(bounds_bytes))
        })
        .ok_or(GeometryError::InvalidSize)?;
    if output_bytes > MAX_CHUNK_BYTES * 2 {
        return Err(GeometryError::InvalidSize);
    }
    Ok((vertices, indices))
}

#[cfg(test)]
mod tests {
    use super::validate;
    use crate::{GeometryError, Part};

    fn budget_boundary_parts() -> Vec<Part> {
        (0..65_536)
            .map(|id| Part {
                id,
                positions: 0,
                normals: 960,
                indices: 1440,
                vertex_count: 80,
                index_count: 66,
            })
            .collect()
    }

    #[test]
    fn accepts_output_at_byte_budget_including_bounds() {
        let parts = budget_boundary_parts();
        assert_eq!(validate(&[0; 1716], &parts), Ok((5_242_880, 4_325_376)));
    }

    #[test]
    fn rejects_output_above_byte_budget_including_bounds() {
        let mut parts = budget_boundary_parts();
        parts.last_mut().unwrap().index_count += 3;
        assert_eq!(
            validate(&[0; 1716], &parts),
            Err(GeometryError::InvalidSize)
        );
    }
}
