import { describe, expect, it } from "vitest";
import type { Atlas, Concept } from "../anatomy";
import { searchConcepts } from "./search-concepts";

function catalogue(concepts: readonly Concept[]): Atlas {
    return { version: "test", parts: [], concepts, chunks: [], triangles: 0 };
}

function concept(name: string, id = name): Concept {
    return { id, name, elements: [] };
}

describe("explorer concept search", () => {
    it("returns available default organs in curated order, including only the first exact match", () => {
        const heart = concept("HEART", "first-heart");
        const atlas = catalogue([
            concept("Trachea"),
            concept("Liver"),
            concept("Brain"),
            heart,
            concept("Heart", "second-heart"),
            concept("Heart valve"),
            concept("Stomach"),
        ]);
        expect(searchConcepts(null, "heart")).toEqual([]);
        expect(searchConcepts(atlas, " \t ")).toEqual([
            heart,
            atlas.concepts[2],
            atlas.concepts[1],
            atlas.concepts[6],
            atlas.concepts[0],
        ]);
    });

    it("normalizes queries, matches names or identifiers, and stably orders by name length", () => {
        const atlas = catalogue([
            concept("Long heart structure"),
            concept("bbb", "HEART-reference"),
            concept("aaa", "heart-other"),
            concept("Heart"),
            concept("Brain"),
        ]);
        const original = [...atlas.concepts];
        expect(
            searchConcepts(atlas, "  HeArT  ").map((item) => item.name),
        ).toEqual(["bbb", "aaa", "Heart", "Long heart structure"]);
        expect(atlas.concepts).toEqual(original);
        expect(searchConcepts(atlas, "not found")).toEqual([]);
    });

    it("matches the original filter/sort contract across queries and independent atlases", () => {
        const concepts = Array.from({ length: 400 }, (_, index) =>
            concept(
                `${index % 3 ? "Heart" : "Brain"} ${"x".repeat(index % 17)}`,
                `ID-${index}`,
            ),
        );
        const atlas = catalogue(concepts);
        for (const query of ["heart", "BRAIN", " id-1 ", "x", "missing"]) {
            const term = query.toLowerCase().trim();
            const expected = concepts
                .filter(
                    (item) =>
                        item.name.toLowerCase().includes(term) ||
                        item.id.toLowerCase().includes(term),
                )
                .sort((a, b) => a.name.length - b.name.length)
                .slice(0, 80);
            expect(searchConcepts(atlas, query)).toEqual(expected);
        }
        const replacement = catalogue([concept("Heart", "new-heart")]);
        expect(searchConcepts(replacement, "heart")).toEqual(
            replacement.concepts,
        );
    });

    it("does not expose cached default arrays to caller mutation", () => {
        const heart = concept("Heart");
        const atlas = catalogue([heart]);
        searchConcepts(atlas, "").pop();
        expect(searchConcepts(atlas, "")).toEqual([heart]);
    });

    it("caps at 80 after sorting, rather than truncating the catalogue before sorting", () => {
        const concepts = Array.from({ length: 90 }, (_, index) =>
            concept(`structure ${"x".repeat(90 - index)}`, `part-${index}`),
        );
        const result = searchConcepts(catalogue(concepts), "part-");
        expect(result).toHaveLength(80);
        expect(result[0]).toBe(concepts[89]);
        expect(result[79]).toBe(concepts[10]);
    });
});
