import { readAtlasManifest } from "./atlas-manifest";
import { performance } from "node:perf_hooks";
import type { Atlas, Concept } from "../src/features/anatomy";
import { searchConcepts } from "../src/features/model/search-concepts";

const atlas: Atlas = readAtlasManifest(
    new URL("../public/models/atlas.json", import.meta.url),
);
const queries = [
    "heart",
    "a",
    "brain",
    "vein",
    "artery",
    "left",
    "FMA",
    "not-a-structure",
];
const repetitions = 5;
const cycles = 100;

function reference(query: string): Concept[] {
    const term = query.toLowerCase().trim();
    return atlas.concepts
        .filter(
            (concept) =>
                concept.name.toLowerCase().includes(term) ||
                concept.id.toLowerCase().includes(term),
        )
        .sort((a, b) => a.name.length - b.name.length)
        .slice(0, 80);
}

const start = performance.now();
searchConcepts(atlas, "");
const initializationMs = performance.now() - start;
for (const query of queries) {
    if (
        JSON.stringify(reference(query)) !==
        JSON.stringify(searchConcepts(atlas, query))
    ) {
        throw new Error(`Search parity failed for ${query}`);
    }
}

function sample(search: (query: string) => Concept[]): number {
    const start = performance.now();
    for (let cycle = 0; cycle < cycles; cycle += 1) {
        for (const query of queries) search(query);
    }
    return (performance.now() - start) / (cycles * queries.length);
}

sample(reference);
sample((query) => searchConcepts(atlas, query));
const referenceMs: number[] = [];
const indexedMs: number[] = [];
for (let run = 0; run < repetitions; run += 1) {
    if (run % 2 === 0) {
        referenceMs.push(sample(reference));
        indexedMs.push(sample((query) => searchConcepts(atlas, query)));
    } else {
        indexedMs.push(sample((query) => searchConcepts(atlas, query)));
        referenceMs.push(sample(reference));
    }
}
console.log(
    JSON.stringify(
        {
            note: "Local CPU microbenchmark, not browser frame-time or target-device evidence.",
            concepts: atlas.concepts.length,
            initializationMs,
            queriesPerRun: cycles * queries.length,
            referenceMsPerQuery: referenceMs,
            indexedMsPerQuery: indexedMs,
        },
        null,
        2,
    ),
);
