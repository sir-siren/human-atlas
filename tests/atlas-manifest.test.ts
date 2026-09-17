import { AssertionError } from "node:assert";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    at,
    MODEL_DATASETS,
    modelDatasets,
    modelDirectory,
    modelFilename,
    parseAtlasManifest,
    readAtlasManifest,
    readModelChunk,
} from "../scripts/atlas-manifest";

function fixture() {
    return {
        version: "test",
        triangles: 1,
        source: "test source",
        attribution: { license: "test" },
        parts: [
            {
                id: "part-1",
                name: "Part",
                conceptId: "concept-1",
                system: "skeletal",
                chunk: 0,
                positions: 0,
                normals: 36,
                indices: 56,
                vertexCount: 3,
                indexCount: 3,
                bounds: [
                    [0, 0, 0],
                    [1, 1, 1],
                ],
            },
        ],
        concepts: [{ id: "concept-1", name: "Concept", elements: ["part-1"] }],
        chunks: [{ url: "/models/source.bin", bytes: 68 }],
    };
}

describe("script manifest boundary", () => {
    it("validates input, permits editing output metadata, and preserves extra source metadata", () => {
        const source = fixture();
        const manifest = parseAtlasManifest(JSON.stringify(source));
        expect(manifest).toEqual(source);
        manifest.parts[0]!.chunk = 1;
        manifest.chunks.push({
            url: "/models/packed.bin",
            bytes: 68,
            gzip: "/models/packed.bin.gz",
            gzipBytes: 30,
        });
        manifest.sourceTriangles = manifest.triangles;
        manifest.optimized = {
            method: "test",
            maximumRelativeError: 0.002,
            preservedMeshes: 1,
        };
        expect(parseAtlasManifest(JSON.stringify(manifest))).toEqual(manifest);
        expect(parseAtlasManifest(JSON.stringify(manifest))).toMatchObject({
            attribution: source.attribution,
        });
    });

    it.each([
        null,
        [],
        { ...fixture(), chunks: [{ url: 42, bytes: 68 }] },
        { ...fixture(), triangles: -1 },
        {
            ...fixture(),
            concepts: [{ id: "concept-1", name: "Concept", elements: [42] }],
        },
        { ...fixture(), parts: [{ ...fixture().parts[0], system: "unknown" }] },
        { ...fixture(), parts: [{ ...fixture().parts[0], positions: 0.5 }] },
        {
            ...fixture(),
            parts: [
                {
                    ...fixture().parts[0],
                    bounds: [
                        [0, 0],
                        [1, 1, 1],
                    ],
                },
            ],
        },
        {
            ...fixture(),
            chunks: [{ url: "/models/source.bin", bytes: 68, gzipBytes: "30" }],
        },
        {
            ...fixture(),
            optimized: {
                method: "test",
                maximumRelativeError: "0.002",
                preservedMeshes: 1,
            },
        },
    ])("rejects invalid manifest fields: %j", (input) => {
        expect(() => parseAtlasManifest(JSON.stringify(input))).toThrow(
            AssertionError,
        );
    });

    it("selects both datasets by default and rejects unknown names", () => {
        expect(modelDatasets([])).toEqual(["male", "female"]);
        expect(modelDatasets(["female"])).toEqual(["female"]);
        expect(() => modelDatasets(["other"])).toThrow(
            "Expected male or female",
        );
    });

    it.each(MODEL_DATASETS)(
        "reads the packaged %s gzip-only dataset",
        (dataset) => {
            const directory = modelDirectory(dataset);
            const manifest = readAtlasManifest(
                new URL("atlas.json", directory),
            );
            expect(manifest.parts).toHaveLength(
                dataset === "male" ? 2234 : 888,
            );
            expect(manifest.concepts).toHaveLength(
                dataset === "male" ? 3432 : 1073,
            );
            expect(manifest.optimized?.preservedMeshes).toBe(
                manifest.parts.length,
            );
            for (const chunk of manifest.chunks) {
                expect(chunk.url).toMatch(
                    new RegExp(`^/models/${dataset}/[^/]+\\.bin$`),
                );
                expect(chunk.gzip).toBe(`${chunk.url}.gz`);
                expect(
                    existsSync(new URL(modelFilename(chunk.gzip!), directory)),
                ).toBe(true);
                expect(readModelChunk(chunk, directory).length).toBe(
                    chunk.bytes,
                );
            }
        },
    );

    it("rejects inconsistent gzip metadata without requiring raw files", () => {
        const directory = modelDirectory("female");
        const chunk = readAtlasManifest(new URL("atlas.json", directory))
            .chunks[0]!;
        expect(() => readModelChunk({ ...chunk, bytes: 1 }, directory)).toThrow(
            "Decoded geometry size mismatch",
        );
        expect(() =>
            readModelChunk({ ...chunk, gzipBytes: 1 }, directory),
        ).toThrow("Gzip size mismatch");
        expect(() =>
            readModelChunk(
                { url: "/models/female/missing.bin", bytes: 1 },
                directory,
            ),
        ).toThrow("Missing geometry");
    });

    it("rejects malformed JSON", () => {
        expect(() => parseAtlasManifest("{")).toThrow(SyntaxError);
    });

    it("checks model filenames and array bounds", () => {
        expect(modelFilename("/models/source.bin")).toBe("source.bin");
        expect(() => modelFilename("/models/")).toThrow(
            "Model URL must end with a filename",
        );
        expect(at(new Uint32Array([4, 5]), 1)).toBe(5);
        expect(() => at([4], 1)).toThrow("Missing entry at index 1");
        expect(() => at([4], -1)).toThrow("Missing entry at index -1");
    });
});
