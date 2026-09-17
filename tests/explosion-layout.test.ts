import { describe, expect, it } from "vitest";
import { createExplosionLayout } from "@/features/explosion-layout";
import type { Part } from "@/features/anatomy";

describe("createExplosionLayout", () => {
    it("returns empty layout for empty parts array", () => {
        const layout = createExplosionLayout([]);
        expect(layout.cells.size).toBe(0);
        expect(layout.width).toBe(0);
        expect(layout.height).toBe(0);
    });

    it("creates non-overlapping cells for parts", () => {
        const mockParts: Part[] = [
            {
                id: "part-1",
                name: "Left Femur",
                conceptId: "concept-femur",
                system: "skeletal",
                chunk: 0,
                positions: 0,
                normals: 0,
                indices: 0,
                vertexCount: 100,
                indexCount: 300,
                bounds: [
                    [0, 0, 0],
                    [0.2, 0.5, 0.2],
                ],
            },
            {
                id: "part-2",
                name: "Right Femur",
                conceptId: "concept-femur",
                system: "skeletal",
                chunk: 0,
                positions: 0,
                normals: 0,
                indices: 0,
                vertexCount: 100,
                indexCount: 300,
                bounds: [
                    [0.3, 0, 0],
                    [0.5, 0.5, 0.2],
                ],
            },
        ];

        const layout = createExplosionLayout(mockParts, 1);
        expect(layout.cells.size).toBe(2);

        const cell1 = layout.cells.get("part-1");
        const cell2 = layout.cells.get("part-2");

        if (!cell1 || !cell2) {
            throw new Error("Expected both cells to be generated in layout");
        }

        const deltaX = Math.abs(cell1.x - cell2.x);
        const deltaY = Math.abs(cell1.y - cell2.y);
        const minSeparationX = (cell1.width + cell2.width) / 2 - 1e-6;
        const minSeparationY = (cell1.height + cell2.height) / 2 - 1e-6;

        const isSeparated =
            deltaX >= minSeparationX || deltaY >= minSeparationY;
        expect(isSeparated).toBe(true);
    });

    it("throws for invalid bounding box coordinates", () => {
        const invalidPart: Part = {
            id: "part-invalid",
            name: "Corrupt",
            conceptId: "c1",
            system: "skeletal",
            chunk: 0,
            positions: 0,
            normals: 0,
            indices: 0,
            vertexCount: 10,
            indexCount: 30,
            bounds: [
                [1, 1, 1],
                [0, 0, 0], // maxX < minX
            ],
        };

        expect(() => createExplosionLayout([invalidPart])).toThrow(
            "An anatomy part has invalid bounds.",
        );
    });
});
