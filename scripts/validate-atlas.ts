import {
    at,
    modelDatasets,
    modelDirectory,
    readAtlasManifest,
    readModelChunk,
} from "./atlas-manifest";
import assert from "node:assert/strict";
for (const dataset of modelDatasets()) {
    const base = modelDirectory(dataset),
        atlas = readAtlasManifest(new URL("atlas.json", base));
    const expected =
        dataset === "male"
            ? { parts: 2234, concepts: 3432 }
            : { parts: 888, concepts: 1073 };
    assert.equal(atlas.parts.length, expected.parts);
    assert.equal(atlas.concepts.length, expected.concepts);
    const ids = new Set(atlas.parts.map((p) => p.id));
    assert.equal(ids.size, expected.parts);
    const files = atlas.chunks.map((c) => {
        assert.ok(c.url.startsWith(`/models/${dataset}/`));
        if (c.gzip) assert.equal(c.gzip, `${c.url}.gz`);
        return readModelChunk(c, base);
    });
    let tris = 0;
    for (const p of atlas.parts) {
        assert.ok(p.name.trim());
        // HRA source labels include placeholders; restoration preserves source metadata.
        if (dataset === "male") {
            assert.ok(p.name !== "-" && !p.name.includes("Bounds("));
            assert.ok(p.conceptId !== "-");
        }
        assert.ok(p.system);
        const b = at(files, p.chunk);
        assert.equal(p.positions % 4, 0);
        assert.equal(p.normals % 2, 0);
        assert.equal(p.indices % 4, 0);
        assert.equal(p.indexCount % 3, 0);
        assert.ok(p.positions + p.vertexCount * 12 <= b.length);
        assert.ok(p.normals + p.vertexCount * 6 <= b.length);
        assert.ok(p.indices + p.indexCount * 4 <= b.length);
        const pos = new Float32Array(
                b.buffer,
                b.byteOffset + p.positions,
                p.vertexCount * 3,
            ),
            indices = new Uint32Array(
                b.buffer,
                b.byteOffset + p.indices,
                p.indexCount,
            );
        assert.ok(indices.length >= 3);
        for (const i of indices)
            assert.ok(i < p.vertexCount, `${p.id}: invalid vertex`);
        for (const value of pos) assert.ok(Number.isFinite(value));
        tris += p.indexCount / 3;
    }
    for (const c of atlas.concepts) {
        assert.ok(c.elements.length);
        for (const id of c.elements)
            assert.ok(ids.has(id), `${c.id}: missing ${id}`);
    }
    assert.equal(tris, atlas.triangles);
    console.log(
        `${dataset}: verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`,
    );
}
