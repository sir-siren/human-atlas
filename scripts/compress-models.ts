import fs from "node:fs";
import {
    modelDatasets,
    modelDirectory,
    modelFilename,
    readAtlasManifest,
    readModelChunk,
} from "./atlas-manifest";
import { gzipSync } from "node:zlib";
for (const dataset of modelDatasets()) {
    const base = modelDirectory(dataset),
        path = new URL("atlas.json", base),
        atlas = readAtlasManifest(path);
    let bytes = 0;
    for (const c of atlas.chunks) {
        const decoded = readModelChunk(c, base);
        if (c.gzip && fs.existsSync(new URL(modelFilename(c.gzip), base))) {
            c.gzipBytes = fs.statSync(
                new URL(modelFilename(c.gzip), base),
            ).size;
            bytes += c.gzipBytes;
            continue;
        }
        const compressed = gzipSync(decoded, { level: 9 });
        c.gzip = c.url + ".gz";
        c.gzipBytes = compressed.length;
        fs.writeFileSync(new URL(modelFilename(c.gzip), base), compressed);
        bytes += compressed.length;
    }
    fs.writeFileSync(path, JSON.stringify(atlas));
    console.log(
        `${dataset}: ${(bytes / 1e6).toFixed(1)} MB compressed download`,
    );
}
