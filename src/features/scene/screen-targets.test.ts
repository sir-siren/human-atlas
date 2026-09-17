import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createRuntimeParts } from "./runtime-parts";
import { createScreenTargets, findScreenTarget } from "./screen-targets";
import type { Part } from "../anatomy";
import type { TargetItem } from "./screen-targets";

const target: TargetItem = {
    index: 7,
    x: 50,
    y: 50,
    left: 40,
    right: 60,
    top: 40,
    bottom: 60,
};

describe("screen targets", () => {
    it("accepts rectangle edges and inclusive radius, rejecting distant targets", () => {
        expect(findScreenTarget([], 50, 50, 12)).toBe(-1);
        expect(findScreenTarget([target], 60, 50, 0)).toBe(7);
        expect(findScreenTarget([target], 72, 50, 12)).toBe(7);
        expect(findScreenTarget([target], 72.01, 50, 12)).toBe(-1);
        expect(findScreenTarget([target], 69, 69, 12)).toBe(-1);
    });

    it("uses center distance to rank overlapping rectangles, retaining first ties", () => {
        const farther = { ...target, index: 8, x: 55 };
        expect(findScreenTarget([farther, target], 50, 50, 12)).toBe(7);
        expect(
            findScreenTarget([target, { ...target, index: 9 }], 50, 50, 12),
        ).toBe(7);
    });

    it("refreshes projected bounds, excludes skin behind solid parts, and clears collapsed targets", () => {
        const part: Part = {
            id: "skin",
            name: "Skin",
            conceptId: "skin",
            system: "integumentary",
            chunk: 0,
            positions: 0,
            normals: 0,
            indices: 0,
            vertexCount: 0,
            indexCount: 0,
            bounds: [
                [-0.1, -0.1, -0.1],
                [0.1, 0.1, 0.1],
            ],
        };
        const parts = createRuntimeParts([
            part,
            { ...part, id: "bone", system: "skeletal" },
        ]);
        parts.forEach((runtime) => {
            runtime.visible = true;
        });
        const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
        camera.position.z = 3;
        camera.updateMatrixWorld();
        const container = document.createElement("div");
        Object.defineProperties(container, {
            clientWidth: { value: 100 },
            clientHeight: { value: 100 },
        });
        const targets = createScreenTargets();
        targets.update(parts, camera, container, 1);
        expect(targets.find(50, 50, 0)).toBe(1);
        const bone = parts[1];
        if (!bone) throw new Error("Missing test bone");
        bone.visible = false;
        targets.update(parts, camera, container, 1);
        expect(targets.find(50, 50, 0)).toBe(0);
        targets.update(parts, camera, container, 0.45);
        expect(targets.find(50, 50, 24)).toBe(-1);
        parts.forEach((runtime) => {
            runtime.offset.z = 200;
        });
        targets.update(parts, camera, container, 1);
        expect(targets.find(50, 50, 24)).toBe(-1);
    });
});
