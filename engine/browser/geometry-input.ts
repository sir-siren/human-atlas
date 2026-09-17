import { decodeModelResponse } from "../../src/features/model-download";
import { MAX_CHUNK_BYTES } from "./engine-types";
import type { GeometryJob, GeometryPart } from "./engine-types";

/**
 * Validate descriptor identities, triangle counts, aligned byte ranges, and buffer budgets.
 * Leave source positions and triangle-index contents to the packing implementation.
 * @throws When a descriptor or declared chunk size exceeds supported limits.
 */
export function validateJob(job: GeometryJob): void {
    if (
        !Number.isSafeInteger(job.bytes) ||
        job.bytes < 0 ||
        job.bytes > MAX_CHUNK_BYTES ||
        job.parts.length > 65536
    ) {
        throw new Error("An anatomy chunk exceeds the supported byte budget.");
    }
    const ids = new Set<number>();
    let outputBytes = 0;
    for (const part of job.parts) {
        if (
            ![
                part.id,
                part.system,
                part.positions,
                part.normals,
                part.indices,
                part.vertexCount,
                part.indexCount,
            ].every(
                (value) =>
                    Number.isSafeInteger(value) &&
                    value >= 0 &&
                    value <= 0xffffffff,
            ) ||
            part.id > 16777216 ||
            ids.has(part.id) ||
            part.vertexCount === 0 ||
            part.indexCount === 0 ||
            part.indexCount % 3 !== 0
        ) {
            throw new Error("An anatomy part has invalid counts or identity.");
        }
        ids.add(part.id);
        for (const [offset, count, width] of [
            [part.positions, part.vertexCount * 3, 4],
            [part.normals, part.vertexCount * 3, 2],
            [part.indices, part.indexCount, 4],
        ] as const) {
            if (offset % width !== 0 || offset + count * width > job.bytes) {
                throw new Error(
                    "An anatomy attribute has an invalid buffer range.",
                );
            }
        }
        outputBytes += part.vertexCount * 22 + part.indexCount * 4;
    }
    if (outputBytes > MAX_CHUNK_BYTES * 2)
        throw new Error("An anatomy chunk exceeds the supported byte budget.");
}

/**
 * Download a chunk, decompressing only when the runtime supports DecompressionStream.
 * Validate the job before fetching; abort the signal to stop in-flight work.
 * @throws When validation, the HTTP response, or final byte length fails.
 */
export async function fetchGeometry(
    job: GeometryJob,
    signal: AbortSignal,
): Promise<ArrayBuffer> {
    validateJob(job);
    const gzip =
        typeof DecompressionStream !== "undefined" ? job.gzip : undefined;
    const response = await fetch(gzip ?? job.url, { signal });
    const source = await decodeModelResponse(
        response,
        job.bytes,
        gzip !== undefined,
    );
    signal.throwIfAborted();
    return source;
}

/**
 * Group part descriptors by system id, preserving first-seen order and input order within groups.
 * Do not mutate the input array.
 */
export function groupParts(
    parts: readonly GeometryPart[],
): Map<number, GeometryPart[]> {
    const groups = new Map<number, GeometryPart[]>();
    for (const part of parts) {
        const group = groups.get(part.system) ?? [];
        group.push(part);
        groups.set(part.system, group);
    }
    return groups;
}
