import { readFile } from "node:fs/promises";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import init from "../../pkg/atlas_wasm.js";
import { prepareWasm } from "../wasm-loader";
import { prepareFallback } from "../geometry-fallback";
import { validateJob } from "../geometry-input";
import type { GeometryJob } from "../engine-types";

function fixture(): { source: ArrayBuffer; job: GeometryJob } {
    const source = new ArrayBuffer(68);
    new Float32Array(source, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    new Int16Array(source, 36, 9).set([0, 0, 32767, 0, 0, -32768, 0, 0, 123]);
    new Uint32Array(source, 56, 3).set([0, 1, 2]);
    const part = {
        id: 73,
        system: 2,
        positions: 0,
        normals: 36,
        indices: 56,
        vertexCount: 3,
        indexCount: 3,
    };
    return {
        source,
        job: {
            url: "chunk",
            bytes: 68,
            parts: [part, { ...part, id: 8 }, { ...part, id: 11, system: 7 }],
        },
    };
}

beforeAll(async () => {
    await init({
        module_or_path: await readFile("engine/pkg/atlas_wasm_bg.wasm"),
    });
});
afterEach(() => vi.unstubAllGlobals());

describe("real WASM geometry", () => {
    it("exactly matches fallback packing, stable identity, signed normals and bounds across systems", async () => {
        const { source, job } = fixture();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(source)));
        const fallback = await prepareFallback(
            job,
            new AbortController().signal,
        );
        const wasm = prepareWasm(source, job);
        expect(wasm).toEqual(fallback);
        expect(Array.from(wasm.batches[0]!.indices)).toEqual([
            0, 1, 2, 3, 4, 5,
        ]);
        expect(Array.from(wasm.batches[0]!.partIndices)).toEqual([
            73, 73, 73, 8, 8, 8,
        ]);
        expect(wasm.batches[0]!.partIds).toEqual([73, 8]);
        const original = wasm.batches[0]!.positions.slice();
        prepareWasm(source, job);
        expect(wasm.batches[0]!.positions).toEqual(original);
    });

    it("rejects invalid triangle indices in both implementations", async () => {
        const { source, job } = fixture();
        new Uint32Array(source, 56, 3)[2] = 3;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(source)));
        expect(() => prepareWasm(source, job)).toThrow("outside its part");
        await expect(
            prepareFallback(job, new AbortController().signal),
        ).rejects.toThrow("outside its part");
    });

    it("rejects malformed sizes, duplicate IDs, unaligned ranges and excessive output before fetching", () => {
        const { job } = fixture();
        for (const invalid of [
            { ...job, bytes: -1 },
            { ...job, bytes: 65 * 1024 * 1024 },
            { ...job, parts: [job.parts[0]!, job.parts[0]!] },
            { ...job, parts: [{ ...job.parts[0]!, positions: 1 }] },
            { ...job, parts: [{ ...job.parts[0]!, vertexCount: 0xffffffff }] },
        ])
            expect(() => validateJob(invalid)).toThrow(/An anatomy/);
    });

    it("preserves exact decoded-size failure", async () => {
        const { job } = fixture();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(new ArrayBuffer(67))),
        );
        await expect(
            prepareFallback(job, new AbortController().signal),
        ).rejects.toThrow("incomplete");
    });
});
