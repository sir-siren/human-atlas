import fs from "node:fs";
import { MeshoptSimplifier } from "meshoptimizer";
import {
    at,
    modelDatasets,
    modelDirectory,
    modelFilename,
    readAtlasManifest,
    readModelChunk,
    type AtlasManifest,
} from "./atlas-manifest";
await MeshoptSimplifier.ready;
for (const dataset of modelDatasets()) {
    const prefix = dataset === "female" ? "female" : "body";
    const dir = modelDirectory(dataset),
        manifest = readAtlasManifest(new URL("atlas.json", dir));
    if (manifest.optimized) {
        console.log(
            `${dataset}: already optimized; preserving packaged geometry.`,
        );
        continue;
    }
    const originals = manifest.chunks.flatMap((c) =>
        [c.url, ...(c.gzip ? [c.gzip] : [])].map(modelFilename),
    );
    const source = manifest.chunks.map((c) => readModelChunk(c, dir));
    let chunks: AtlasManifest["chunks"] = [],
        segments: Buffer[] = [],
        bytes = 0,
        triangles = 0,
        maxError = 0;
    const flush = () => {
        if (!bytes) return;
        const url = `/models/${dataset}/${prefix}-${chunks.length}.bin`;
        fs.writeFileSync(
            new URL(modelFilename(url), dir),
            Buffer.concat(segments),
        );
        chunks.push({ url, bytes });
        segments = [];
        bytes = 0;
    };
    const append = (a: Float32Array | Int16Array | Uint32Array): number => {
        const padding = (4 - (bytes % 4)) % 4;
        if (padding) {
            segments.push(Buffer.alloc(padding));
            bytes += padding;
        }
        const offset = bytes;
        const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength);
        segments.push(b);
        bytes += b.length;
        return offset;
    };
    for (const p of manifest.parts) {
        const b = at(source, p.chunk);
        let pos = new Float32Array(
                b.buffer,
                b.byteOffset + p.positions,
                p.vertexCount * 3,
            ),
            normal = new Int16Array(
                b.buffer,
                b.byteOffset + p.normals,
                p.vertexCount * 3,
            ),
            indices = new Uint32Array(
                b.buffer,
                b.byteOffset + p.indices,
                p.indexCount,
            );
        if (prefix === "female") {
            // HRA exports often duplicate vertices at triangle boundaries. Weld coincident positions
            // before simplification, averaging their source normals for smooth anatomical surfaces.
            const map = new Map<string, number>(),
                remap = new Uint32Array(p.vertexCount),
                wp: number[] = [],
                wn: number[] = [];
            for (let i = 0; i < p.vertexCount; i++) {
                const k = `${pos[i * 3]},${pos[i * 3 + 1]},${pos[i * 3 + 2]}`;
                let index = map.get(k);
                if (index === undefined) {
                    index = wp.length / 3;
                    map.set(k, index);
                    wp.push(
                        at(pos, i * 3),
                        at(pos, i * 3 + 1),
                        at(pos, i * 3 + 2),
                    );
                    wn.push(0, 0, 0);
                }
                remap[i] = index;
                for (let a = 0; a < 3; a++)
                    wn[index * 3 + a] =
                        at(wn, index * 3 + a) + at(normal, i * 3 + a);
            }
            for (let i = 0; i < wn.length; i += 3) {
                const length =
                    Math.hypot(at(wn, i), at(wn, i + 1), at(wn, i + 2)) || 1;
                for (let a = 0; a < 3; a++)
                    wn[i + a] = Math.round((at(wn, i + a) / length) * 32767);
            }
            pos = new Float32Array(wp);
            normal = new Int16Array(wn);
            indices = Uint32Array.from(indices, (i) => at(remap, i));
        }
        // Preserve each named mesh, narrow vessels, and small organs. Bound geometric error to 0.2% of each part's extent.
        const target = Math.max(96, Math.floor((p.indexCount * 0.22) / 3) * 3);
        const [simplified, error] = MeshoptSimplifier.simplify(
            indices,
            pos,
            3,
            Math.min(indices.length, target),
            0.002,
        );
        maxError = Math.max(maxError, error);
        const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
        const positions = new Float32Array(count * 3),
            normals = new Int16Array(count * 3);
        for (let old = 0; old < remap.length; old++) {
            const n = at(remap, old);
            if (n === 0xffffffff) continue;
            positions.set(pos.subarray(old * 3, old * 3 + 3), n * 3);
            normals.set(normal.subarray(old * 3, old * 3 + 3), n * 3);
        }
        if (bytes > 4_000_000) flush();
        p.chunk = chunks.length;
        p.positions = append(positions);
        p.normals = append(normals);
        p.indices = append(simplified);
        p.vertexCount = count;
        p.indexCount = simplified.length;
        triangles += simplified.length / 3;
    }
    flush();
    manifest.sourceTriangles = manifest.triangles;
    manifest.triangles = triangles;
    manifest.chunks = chunks;
    manifest.optimized = {
        method: "meshoptimizer quadric simplification",
        maximumRelativeError: 0.002,
        preservedMeshes: manifest.parts.length,
    };
    fs.writeFileSync(new URL("atlas.json", dir), JSON.stringify(manifest));
    const retained = new Set(chunks.map((c) => modelFilename(c.url)));
    for (const name of originals) {
        if (!retained.has(name)) fs.rmSync(new URL(name, dir), { force: true });
    }
    console.log(
        JSON.stringify({
            dataset,
            parts: manifest.parts.length,
            triangles,
            bytes: chunks.reduce((n, c) => n + c.bytes, 0),
            chunks: chunks.length,
            maxError,
        }),
    );
}
