import init, { prepare_chunk } from "../pkg/atlas_wasm.js";
import { groupParts } from "./geometry-input";
import type { GeometryJob, PackedBatch, PreparedChunk } from "./engine-types";

let initialized: Promise<unknown> | undefined;
/** Initialize the shared WASM module once; retain the same promise, including rejection. */
export function initializeWasm(): Promise<unknown> {
    initialized ??= init();
    return initialized;
}

/**
 * Pack a validated chunk synchronously after awaiting initializeWasm.
 * Keep the source buffer by reference; copy packed output into independently owned JS buffers.
 * @throws When WASM is uninitialized or rejects geometry, counts, ranges, or allocations.
 */
export function prepareWasm(
    source: ArrayBuffer,
    job: GeometryJob,
): PreparedChunk {
    const batches: PackedBatch[] = [];
    for (const [system, parts] of groupParts(job.parts)) {
        const descriptors = new Uint32Array(parts.length * 6);
        parts.forEach((part, index) =>
            descriptors.set(
                [
                    part.id,
                    part.positions,
                    part.normals,
                    part.indices,
                    part.vertexCount,
                    part.indexCount,
                ],
                index * 6,
            ),
        );
        const packed = prepare_chunk(new Uint8Array(source), descriptors);
        try {
            // wasm-bindgen's Vec getters copy out to JS-owned buffers, never transfer linear memory.
            batches.push({
                system,
                partIds: parts.map((part) => part.id),
                positions: packed.positions() as Float32Array<ArrayBuffer>,
                normals: packed.normals() as Int16Array<ArrayBuffer>,
                indices: packed.indices() as Uint32Array<ArrayBuffer>,
                partIndices: packed.part_indices() as Float32Array<ArrayBuffer>,
                bounds: packed.bounds() as Float32Array<ArrayBuffer>,
            });
        } finally {
            packed.free();
        }
    }
    return { source, batches };
}
