import { fetchGeometry, groupParts } from "./geometry-input";
import type { GeometryJob, PackedBatch, PreparedChunk } from "./engine-types";

export async function prepareFallback(
    job: GeometryJob,
    signal: AbortSignal,
): Promise<PreparedChunk> {
    const source = await fetchGeometry(job, signal);
    const batches: PackedBatch[] = [];
    for (const [system, parts] of groupParts(job.parts)) {
        const vertexCount = parts.reduce(
            (count, part) => count + part.vertexCount,
            0,
        );
        const indexCount = parts.reduce(
            (count, part) => count + part.indexCount,
            0,
        );
        const positions = new Float32Array(vertexCount * 3);
        const normals = new Int16Array(vertexCount * 3);
        const indices = new Uint32Array(indexCount);
        const partIndices = new Float32Array(vertexCount);
        const bounds = new Float32Array(parts.length * 6);
        let vertexOffset = 0;
        let indexOffset = 0;
        for (const [partOffset, part] of parts.entries()) {
            const inputPositions = new Float32Array(
                source,
                part.positions,
                part.vertexCount * 3,
            );
            const inputIndices = new Uint32Array(
                source,
                part.indices,
                part.indexCount,
            );
            const min = [Infinity, Infinity, Infinity];
            const max = [-Infinity, -Infinity, -Infinity];
            for (let index = 0; index < inputPositions.length; index += 1) {
                const value = inputPositions[index]!;
                if (!Number.isFinite(value))
                    throw new Error("An anatomy position is not finite.");
                const axis = index % 3;
                min[axis] = Math.min(min[axis]!, value);
                max[axis] = Math.max(max[axis]!, value);
            }
            positions.set(inputPositions, vertexOffset * 3);
            normals.set(
                new Int16Array(source, part.normals, part.vertexCount * 3),
                vertexOffset * 3,
            );
            for (let index = 0; index < inputIndices.length; index += 1) {
                const value = inputIndices[index]!;
                if (value >= part.vertexCount)
                    throw new Error(
                        "An anatomy triangle index is outside its part.",
                    );
                indices[indexOffset + index] = value + vertexOffset;
            }
            bounds.set(min, partOffset * 6);
            bounds.set(max, partOffset * 6 + 3);
            partIndices.fill(
                part.id,
                vertexOffset,
                vertexOffset + part.vertexCount,
            );
            vertexOffset += part.vertexCount;
            indexOffset += part.indexCount;
        }
        batches.push({
            system,
            partIds: parts.map((part) => part.id),
            positions,
            normals,
            indices,
            partIndices,
            bounds,
        });
    }
    signal.throwIfAborted();
    return { source, batches };
}
