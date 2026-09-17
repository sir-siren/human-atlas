import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createMarkers } from "./create-markers";
import { createPartTextures } from "./part-materials";
import { createRuntimeParts } from "./runtime-parts";
import { createSceneAnimation } from "./scene-animation";
import type { Atlas, SceneState } from "../anatomy";

it("invalidates motion after loading and resize while keeping stationary frames cached", () => {
    const atlas: Atlas = {
        version: "test",
        concepts: [],
        chunks: [],
        triangles: 0,
        parts: [
            {
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
                    [0.2, 1, 0.2],
                ],
            },
        ],
    };
    const state: SceneState = {
        explode: 0,
        visible: ["skeletal"],
        selected: [],
        isolate: false,
        view: "front",
        rotate: false,
        reset: 0,
    };
    const container = document.createElement("div");
    Object.defineProperties(container, {
        clientWidth: { value: 1000 },
        clientHeight: { value: 800 },
    });
    const camera = new THREE.PerspectiveCamera(34, 1.25, 0.005, 100);
    const controls = new OrbitControls(
        camera,
        document.createElement("canvas"),
    );
    const stage = {
        camera,
        controls,
        ground: new THREE.Mesh(
            new THREE.CircleGeometry(),
            new THREE.MeshStandardMaterial(),
        ),
        platform: new THREE.Mesh(
            new THREE.CylinderGeometry(),
            new THREE.MeshStandardMaterial(),
        ),
        ring: new THREE.Mesh(
            new THREE.RingGeometry(),
            new THREE.MeshBasicMaterial(),
        ),
        innerRing: new THREE.Mesh(
            new THREE.RingGeometry(),
            new THREE.MeshBasicMaterial(),
        ),
    };
    const runtimeParts = createRuntimeParts(atlas.parts);
    const textures = createPartTextures(1);
    const markerLayer = createMarkers(1, new THREE.Scene());
    const invalidate = vi.fn<() => void>();
    const animation = createSceneAnimation({
        atlas,
        container,
        stage,
        runtimeParts,
        textures,
        markerLayer,
        invalidate,
    });
    try {
        animation.update(state, 0.016);
        expect(invalidate).toHaveBeenCalled();
        const firstVersion = textures.partTexture.version;
        invalidate.mockClear();
        animation.update(state, 0.016);
        expect(textures.partTexture.version).toBe(firstVersion);
        expect(invalidate).not.toHaveBeenCalled();
        animation.invalidateParts();
        animation.update(state, 0.016);
        expect(textures.partTexture.version).toBe(firstVersion + 1);
        animation.invalidateLayout();
        animation.update(state, 0.016);
        expect(textures.partTexture.version).toBe(firstVersion + 2);
        animation.update(
            { ...state, selected: ["bone"], isolate: true },
            0.016,
        );
        expect(camera.view?.enabled).toBe(true);
        animation.update(state, 0.016);
        expect(camera.view?.enabled).toBe(false);
        animation.update({ ...state, explode: 1 }, 0.05);
        expect(animation.extent).toBeCloseTo(
            THREE.MathUtils.damp(0, 1, 8, 0.05),
        );
        animation.update({ ...state, visible: [], selected: [] }, 0.016);
        expect(runtimeParts[0]?.visible).toBe(false);
        const exploded = { ...state, explode: 1 };
        let active = true;
        for (let frame = 0; frame < 300 && active; frame++)
            active = animation.update(exploded, 1 / 60);
        expect(active).toBe(false);
        expect(animation.extent).toBe(1);
        const selectionVersion = textures.selectionTexture.version;
        animation.update({ ...exploded, explode: 0.5 }, 1 / 60);
        expect(textures.selectionTexture.version).toBe(selectionVersion);
        animation.update({ ...state, rotate: true }, 1 / 60, true);
        expect(animation.extent).toBe(0);
        expect(controls.autoRotate).toBe(false);
        expect(controls.enableDamping).toBe(false);
    } finally {
        controls.dispose();
        for (const mesh of [
            stage.ground,
            stage.platform,
            stage.ring,
            stage.innerRing,
        ]) {
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        textures.partTexture.dispose();
        textures.selectionTexture.dispose();
        markerLayer.markerGeometry.dispose();
        markerLayer.markerMaterial.dispose();
    }
});
