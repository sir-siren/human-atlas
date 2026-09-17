import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMarkers } from "./create-markers";
import { createPartTextures } from "./part-materials";
import { calculatePartOffset, updatePartMotion } from "./part-motion";
import { createRuntimeParts } from "./runtime-parts";
import type { Part, SceneState } from "../anatomy";

const part: Part = {
    id: "bone",
    name: "Bone",
    conceptId: "bone",
    system: "skeletal",
    chunk: 0,
    positions: 0,
    normals: 0,
    indices: 0,
    vertexCount: 0,
    indexCount: 0,
    bounds: [
        [0, 0, 0],
        [2, 2, 2],
    ],
};

const state: SceneState = {
    explode: 1,
    visible: [],
    selected: [part.id],
    isolate: false,
    view: "front",
    rotate: false,
    reset: 0,
};

describe("part motion", () => {
    it("preserves the grouped and flattened phases without mutating inputs", () => {
        const center = new THREE.Vector3(1, 1.85, 2);
        const destination = new THREE.Vector3(3, 4.85, 0);
        expect(calculatePartOffset(center, destination, "skeletal", 0)).toEqual(
            [0, 0, 0],
        );
        const grouped = calculatePartOffset(
            center,
            destination,
            "skeletal",
            0.45,
        );
        expect(grouped[0]).toBe(0);
        expect(grouped[1]).toBeCloseTo(0.28);
        expect(grouped[2]).toBe(0.48);
        const halfway = calculatePartOffset(
            center,
            destination,
            "skeletal",
            0.725,
        );
        expect(halfway[0]).toBeCloseTo(1);
        expect(halfway[1]).toBeCloseTo(1.64);
        expect(halfway[2]).toBeCloseTo(-0.76);
        const flattened = calculatePartOffset(
            center,
            destination,
            "skeletal",
            1,
        );
        expect(flattened[0]).toBeCloseTo(2);
        expect(flattened[1]).toBeCloseTo(3);
        expect(flattened[2]).toBeCloseTo(-2);
        expect(center.toArray()).toEqual([1, 1.85, 2]);
        expect(destination.toArray()).toEqual([3, 4.85, 0]);
    });

    it("initializes independent bounds, destinations and offsets with missing coordinates defaulted", () => {
        const [runtime] = createRuntimeParts([{ ...part, bounds: [[], [2]] }]);
        expect(runtime?.bounds.min.toArray()).toEqual([0, 0, 0]);
        expect(runtime?.center.toArray()).toEqual([1, 0, 0]);
        expect(runtime?.destination).not.toBe(runtime?.center);
        expect(runtime?.offset.toArray()).toEqual([0, 0, 0]);
        expect(runtime?.visible).toBe(false);
        expect(runtime?.picker).toBeUndefined();
    });

    it("updates selected visibility, GPU textures, markers and picker matrices together", () => {
        const parts = createRuntimeParts([part]);
        const runtime = parts[0];
        if (!runtime) throw new Error("Missing test part");
        runtime.destination.set(4, 5, 0);
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.MeshBasicMaterial();
        runtime.picker = new THREE.Mesh(geometry, material);
        runtime.picker.matrixAutoUpdate = false;
        const textures = createPartTextures(1);
        const markers = createMarkers(1, new THREE.Scene());
        try {
            const textureVersion = textures.partTexture.version;
            updatePartMotion(parts, state, 1, textures, markers);
            expect(runtime.visible).toBe(true);
            expect(Array.from(textures.stateData)).toEqual([3, 4, -1, 1]);
            expect(textures.selectedData[0]).toBe(255);
            expect(Array.from(markers.markerPositions)).toEqual([4, 5, 0]);
            expect(runtime.picker.position.toArray()).toEqual([3, 4, -1]);
            expect(
                new THREE.Vector3()
                    .setFromMatrixPosition(runtime.picker.matrixWorld)
                    .toArray(),
            ).toEqual([3, 4, -1]);
            expect(textures.partTexture.version).toBe(textureVersion + 1);
            expect(markers.markerAttribute.version).toBe(1);

            updatePartMotion(
                parts,
                {
                    ...state,
                    visible: ["skeletal"],
                    selected: [],
                    isolate: true,
                },
                0,
                textures,
                markers,
            );
            expect(runtime.visible).toBe(false);
            expect(textures.stateData[3]).toBe(0);
            expect(textures.selectedData[0]).toBe(0);
            expect(Array.from(markers.markerPositions)).toEqual([
                10000, 10000, 10000,
            ]);
        } finally {
            geometry.dispose();
            material.dispose();
            textures.partTexture.dispose();
            textures.selectionTexture.dispose();
            markers.markerGeometry.dispose();
            markers.markerMaterial.dispose();
        }
    });
});
