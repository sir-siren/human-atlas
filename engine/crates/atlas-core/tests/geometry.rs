use atlas_core::{GeometryError, Part, prepare_geometry};

fn triangle() -> (Vec<u8>, Part) {
    let mut data = vec![0u8; 68];
    for (index, value) in [0f32, 0., 0., 1., 0., 0., 0., 1., 0.]
        .into_iter()
        .enumerate()
    {
        data[index * 4..index * 4 + 4].copy_from_slice(&value.to_le_bytes());
    }
    for index in 0..3usize {
        data[56 + index * 4..60 + index * 4].copy_from_slice(&(index as u32).to_le_bytes());
    }
    (
        data,
        Part {
            id: 23,
            positions: 0,
            normals: 36,
            indices: 56,
            vertex_count: 3,
            index_count: 3,
        },
    )
}

#[test]
fn packs_offsets_identity_normals_and_bounds() {
    let (data, part) = triangle();
    let second = Part { id: 4, ..part };
    let result = prepare_geometry(&data, &[part, second]).unwrap();
    assert_eq!(result.indices, [0, 1, 2, 3, 4, 5]);
    assert_eq!(result.part_indices, [23., 23., 23., 4., 4., 4.]);
    assert_eq!(
        result.bounds,
        [0., 0., 0., 1., 1., 0., 0., 0., 0., 1., 1., 0.]
    );
    assert_eq!(result.positions.len(), 18);
    assert_eq!(result.normals.len(), 18);
}

#[test]
fn rejects_invalid_indices_and_nonfinite_positions() {
    let (mut data, part) = triangle();
    data[56..60].copy_from_slice(&3u32.to_le_bytes());
    assert_eq!(
        prepare_geometry(&data, &[part]).unwrap_err(),
        GeometryError::InvalidIndex
    );
    data[56..60].copy_from_slice(&0u32.to_le_bytes());
    data[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
    assert_eq!(
        prepare_geometry(&data, &[part]).unwrap_err(),
        GeometryError::InvalidPosition
    );
}

#[test]
fn rejects_bad_ranges_counts_duplicates_and_overflows() {
    let (data, part) = triangle();
    for invalid in [
        Part {
            positions: 1,
            ..part
        },
        Part {
            normals: usize::MAX,
            ..part
        },
        Part {
            vertex_count: usize::MAX,
            ..part
        },
    ] {
        assert!(prepare_geometry(&data, &[invalid]).is_err());
    }
    assert!(prepare_geometry(&data, &[part, part]).is_err());
    assert!(prepare_geometry(&data[..67], &[part]).is_err());
    assert!(
        prepare_geometry(
            &data,
            &[Part {
                index_count: 2,
                ..part
            }]
        )
        .is_err()
    );
    assert!(
        prepare_geometry(
            &data,
            &[Part {
                id: 16_777_217,
                ..part
            }]
        )
        .is_err()
    );
}

#[test]
fn accepts_empty_chunk() {
    let result = prepare_geometry(&[], &[]).unwrap();
    assert!(result.positions.is_empty());
    assert!(result.indices.is_empty());
    assert!(result.normals.is_empty());
    assert!(result.part_indices.is_empty());
    assert!(result.bounds.is_empty());
}

#[test]
fn preserves_position_bits_and_signed_normals_for_overlapping_parts() {
    let (mut source, part) = triangle();
    let positions = [-0.0f32, -2.5, 3.25, 1.0, 4.5, -6.0, -7.0, 8.0, 9.0];
    let normals = [i16::MIN, i16::MAX, -1, 0, 1, -1234, 1234, -32767, 42];
    for (destination, value) in source[..36]
        .as_chunks_mut::<4>()
        .0
        .iter_mut()
        .zip(positions)
    {
        destination.copy_from_slice(&value.to_le_bytes());
    }
    for (destination, value) in source[36..54]
        .as_chunks_mut::<2>()
        .0
        .iter_mut()
        .zip(normals)
    {
        destination.copy_from_slice(&value.to_le_bytes());
    }
    let original = source.clone();
    let output = prepare_geometry(
        &source,
        &[
            part,
            Part {
                id: 16_777_216,
                ..part
            },
        ],
    )
    .unwrap();
    assert_eq!(source, original);
    for packed in output.positions.as_chunks::<9>().0 {
        for (actual, expected) in packed.iter().zip(positions) {
            assert_eq!(actual.to_bits(), expected.to_bits());
        }
    }
    assert_eq!(output.positions.len(), 18);
    assert_eq!(output.normals, normals.repeat(2));
    assert_eq!(output.indices, [0, 1, 2, 3, 4, 5]);
    assert_eq!(
        output.part_indices,
        [23., 23., 23., 16_777_216., 16_777_216., 16_777_216.]
    );
    assert_eq!(output.bounds, [-7., -2.5, -6., 1., 8., 9.].repeat(2));
}

#[test]
fn rejects_each_nonfinite_position_and_out_of_range_index() {
    let (mut source, part) = triangle();
    for position in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        source[32..36].copy_from_slice(&position.to_le_bytes());
        assert_eq!(
            prepare_geometry(&source, &[part]).unwrap_err(),
            GeometryError::InvalidPosition
        );
    }
    source[32..36].copy_from_slice(&0f32.to_le_bytes());
    for index in [3, u32::MAX] {
        source[64..68].copy_from_slice(&index.to_le_bytes());
        assert_eq!(
            prepare_geometry(&source, &[part]).unwrap_err(),
            GeometryError::InvalidIndex
        );
    }
}

#[test]
fn rejects_zero_counts_misalignment_and_too_many_parts() {
    let (source, part) = triangle();
    for invalid in [
        Part {
            vertex_count: 0,
            ..part
        },
        Part {
            index_count: 0,
            ..part
        },
    ] {
        assert_eq!(
            prepare_geometry(&source, &[invalid]).unwrap_err(),
            GeometryError::InvalidPart
        );
    }
    for invalid in [
        Part {
            normals: 37,
            ..part
        },
        Part {
            indices: 55,
            ..part
        },
    ] {
        assert_eq!(
            prepare_geometry(&source, &[invalid]).unwrap_err(),
            GeometryError::InvalidRange
        );
    }
    assert_eq!(
        prepare_geometry(&source, &vec![part; 65_537]).unwrap_err(),
        GeometryError::InvalidSize
    );
}
