import { describe, expect, it, vi } from "vitest";
import { atlasTools } from "@/features/agent-tools";
import type { Atlas, Concept } from "@/features/anatomy";

describe("atlasTools", () => {
    const mockAtlas: Atlas = {
        version: "1.0",
        parts: [],
        concepts: [
            { id: "c-femur", name: "Femur", elements: ["part-1", "part-2"] },
            { id: "c-humerus", name: "Humerus", elements: ["part-3"] },
        ],
        chunks: [],
        triangles: 100,
    };

    it("finds anatomical structures by substring search", () => {
        const inspectMock = vi.fn<(concept: Concept) => void>();
        const tools = atlasTools(mockAtlas, inspectMock);
        const findTool = tools.find((t) => t.name === "find_anatomy");
        expect(findTool).toBeDefined();

        if (!findTool) {
            throw new Error("Expected find_anatomy tool to exist");
        }

        const results = findTool.execute({ query: "fem" }) as {
            id: string;
            name: string;
        }[];
        expect(results).toHaveLength(1);
        expect(results[0]?.name).toBe("Femur");
    });

    it("inspects an anatomical concept and invokes the callback", () => {
        let inspected: Concept | null = null;
        const tools = atlasTools(mockAtlas, (c) => {
            inspected = c;
        });

        const inspectTool = tools.find(
            (t) => t.name === "inspect_anatomical_structure",
        );
        expect(inspectTool).toBeDefined();

        if (!inspectTool) {
            throw new Error(
                "Expected inspect_anatomical_structure tool to exist",
            );
        }

        const res = inspectTool.execute({ id: "c-femur" }) as {
            id: string;
            name: string;
        };
        expect(res.name).toBe("Femur");
        expect(inspected).toEqual({
            id: "c-femur",
            name: "Femur",
            elements: ["part-1", "part-2"],
        });
    });

    it("throws error on empty query or invalid id", () => {
        const tools = atlasTools(mockAtlas, () => {});
        const findTool = tools.find((t) => t.name === "find_anatomy");
        const inspectTool = tools.find(
            (t) => t.name === "inspect_anatomical_structure",
        );

        expect(() => findTool?.execute({ query: "   " })).toThrow(
            "A nonempty query is required.",
        );
        expect(() => inspectTool?.execute({ id: "non-existent" })).toThrow(
            "That structure is not present in this atlas.",
        );
    });
});
