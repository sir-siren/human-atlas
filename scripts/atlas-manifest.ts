import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
    SYSTEMS,
    type Atlas,
    type Part,
    type ChunkInfo,
} from "../src/features/anatomy";

export const MODEL_DATASETS = ["male", "female"] as const;
export type ModelDataset = (typeof MODEL_DATASETS)[number];

/** Select dataset names for a pipeline command; omitted arguments select both. */
export function modelDatasets(args = process.argv.slice(2)): ModelDataset[] {
    if (!args.length) return [...MODEL_DATASETS];
    return args.map((name) => {
        assert.ok(
            name === "male" || name === "female",
            "Expected male or female",
        );
        return name;
    });
}

/** Resolve the directory containing a dataset's atlas.json and geometry chunks. */
export function modelDirectory(dataset: ModelDataset): URL {
    return new URL(`../public/models/${dataset}/`, import.meta.url);
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export interface AtlasManifest extends Omit<
    Atlas,
    "parts" | "chunks" | "triangles" | "sex"
> {
    parts: Mutable<Part>[];
    chunks: Mutable<ChunkInfo>[];
    triangles: number;
    sourceTriangles?: number;
    optimized?: {
        method: string;
        maximumRelativeError: number;
        preservedMeshes: number;
    };
}

function record(value: unknown): asserts value is Record<string, unknown> {
    assert.ok(
        typeof value === "object" && value !== null && !Array.isArray(value),
        "Expected an object",
    );
}
function text(value: unknown): asserts value is string {
    assert.equal(typeof value, "string", "Expected a string");
}
function count(value: unknown): asserts value is number {
    assert.ok(
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
        "Expected a nonnegative integer",
    );
}
function array(value: unknown): asserts value is unknown[] {
    assert.ok(Array.isArray(value), "Expected an array");
}

/**
 * Parse a catalogue into mutable geometry metadata while preserving extra JSON fields.
 *
 * Validate field shapes, not cross-references or buffer contents; run the atlas validator
 * before publishing rewritten assets.
 * @throws {SyntaxError} When the input is not JSON.
 * @throws {AssertionError} When a required field is missing or has an invalid value.
 */
export function parseAtlasManifest(json: string): AtlasManifest {
    const value: unknown = JSON.parse(json);
    validateManifest(value);
    return value;
}

function validateManifest(value: unknown): asserts value is AtlasManifest {
    record(value);
    text(value.version);
    count(value.triangles);
    for (const key of ["source", "scope"] as const) {
        if (value[key] !== undefined) text(value[key]);
    }
    array(value.parts);
    array(value.chunks);
    array(value.concepts);
    for (const part of value.parts) {
        record(part);
        for (const key of ["id", "name", "conceptId", "system"] as const)
            text(part[key]);
        assert.ok(
            SYSTEMS.some((system) => system.id === part.system),
            "Unknown anatomy system",
        );
        for (const key of [
            "chunk",
            "positions",
            "normals",
            "indices",
            "vertexCount",
            "indexCount",
        ] as const)
            count(part[key]);
        array(part.bounds);
        assert.equal(part.bounds.length, 2);
        for (const point of part.bounds) {
            array(point);
            assert.equal(point.length, 3);
            for (const coordinate of point)
                assert.ok(
                    typeof coordinate === "number" &&
                        Number.isFinite(coordinate),
                );
        }
    }
    for (const chunk of value.chunks) {
        record(chunk);
        text(chunk.url);
        count(chunk.bytes);
        if (chunk.gzip !== undefined) text(chunk.gzip);
        if (chunk.gzipBytes !== undefined) count(chunk.gzipBytes);
    }
    for (const concept of value.concepts) {
        record(concept);
        text(concept.id);
        text(concept.name);
        array(concept.elements);
        for (const id of concept.elements) text(id);
    }
    if (value.sourceTriangles !== undefined) count(value.sourceTriangles);
    if (value.optimized !== undefined) {
        record(value.optimized);
        text(value.optimized.method);
        count(value.optimized.preservedMeshes);
        assert.ok(
            typeof value.optimized.maximumRelativeError === "number" &&
                Number.isFinite(value.optimized.maximumRelativeError),
        );
    }
}

/**
 * Read and validate a UTF-8 catalogue synchronously for command-line asset processing.
 * @throws When file access, JSON parsing, or manifest field validation fails.
 */
export function readAtlasManifest(path: URL): AtlasManifest {
    return parseAtlasManifest(readFileSync(path, "utf8"));
}

/**
 * Read decoded geometry from raw converter output or a gzip-only release.
 * Validate compressed and decoded lengths; reject corrupt or inconsistent assets.
 */
export function readModelChunk(chunk: ChunkInfo, directory: URL): Buffer {
    const rawPath = new URL(modelFilename(chunk.url), directory);
    let decoded: Buffer | undefined;
    if (chunk.gzip) {
        const gzipPath = new URL(modelFilename(chunk.gzip), directory);
        if (existsSync(gzipPath)) {
            const compressed = readFileSync(gzipPath);
            if (chunk.gzipBytes !== undefined)
                assert.equal(
                    compressed.length,
                    chunk.gzipBytes,
                    "Gzip size mismatch",
                );
            decoded = gunzipSync(compressed);
        }
    }
    if (existsSync(rawPath)) {
        const raw = readFileSync(rawPath);
        if (decoded)
            assert.ok(raw.equals(decoded), "Raw and gzip geometry differ");
        decoded = raw;
    }
    assert.ok(decoded, `Missing geometry: ${chunk.url}`);
    assert.equal(decoded.length, chunk.bytes, "Decoded geometry size mismatch");
    return decoded;
}

/**
 * Extract the last slash-delimited segment from a manifest asset path.
 * Pass a pathname without query parameters or a fragment; neither is stripped.
 * @throws {AssertionError} When the final segment is empty.
 */
export function modelFilename(url: string): string {
    const filename = url.split("/").pop();
    assert.ok(filename, "Model URL must end with a filename");
    return filename;
}

/**
 * Read a required entry without allowing missing or explicitly undefined values.
 * @throws {AssertionError} When the indexed value is undefined.
 */
export function at<T>(values: ArrayLike<T>, index: number): T {
    const value = values[index];
    assert.ok(value !== undefined, `Missing entry at index ${index}`);
    return value;
}
