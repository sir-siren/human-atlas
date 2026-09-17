import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { loadGeometry } from "./load-geometry";
import { createRuntimeParts } from "./runtime-parts";
import type { Atlas, Part, SystemId } from "../anatomy";

function setup(parts: readonly Part[] = [], chunkCount = 1) {
    const atlas: Atlas = {
        version: "test",
        parts,
        concepts: [],
        triangles: 0,
        chunks: Array.from({ length: chunkCount }, (_, index) => ({
            url: `chunk-${index}`,
            bytes: parts.length ? 68 : 0,
        })),
    };
    const controller = new AbortController();
    const geometries: THREE.BufferGeometry[] = [];
    const material = new THREE.MeshStandardMaterial();
    const options = {
        atlas,
        signal: controller.signal,
        shouldStop: () => controller.signal.aborted,
        runtimeParts: createRuntimeParts(parts),
        geometries,
        pickerMaterial: new THREE.MeshBasicMaterial(),
        systemMaterials: new Map<SystemId, THREE.MeshStandardMaterial>([
            ["skeletal", material],
        ]),
        scene: new THREE.Scene(),
        onChunkLoaded: vi.fn<(progress: number) => void>(),
        onReady: vi.fn<() => void>(),
        onError: vi.fn<(message: string) => void>(() => controller.abort()),
    };
    return {
        options,
        controller,
        dispose() {
            geometries.forEach((geometry) => geometry.dispose());
            options.pickerMaterial.dispose();
            material.dispose();
        },
    };
}

afterEach(() => vi.unstubAllGlobals());

describe("geometry loading", () => {
    it("assembles typed geometry and pickers, reports progress, and retains disposal ownership", async () => {
        const part: Part = {
            id: "bone",
            name: "Bone",
            conceptId: "bone",
            system: "skeletal",
            chunk: 0,
            positions: 0,
            normals: 36,
            indices: 56,
            vertexCount: 3,
            indexCount: 3,
            bounds: [
                [0, 0, 0],
                [1, 1, 0],
            ],
        };
        const buffer = new ArrayBuffer(68);
        new Float32Array(buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        new Int16Array(buffer, 36, 9).set([
            0, 0, 32767, 0, 0, 32767, 0, 0, 32767,
        ]);
        new Uint32Array(buffer, 56, 3).set([0, 1, 2]);
        const fetch = vi
            .fn<typeof globalThis.fetch>()
            .mockResolvedValue(new Response(buffer));
        vi.stubGlobal("fetch", fetch);
        const { options, dispose } = setup([part]);
        try {
            await loadGeometry(options);
            expect(fetch).toHaveBeenCalledWith("chunk-0", {
                signal: expect.any(AbortSignal),
            });
            expect(options.onChunkLoaded).toHaveBeenCalledWith(100);
            expect(options.onReady).toHaveBeenCalledOnce();
            expect(options.onError).not.toHaveBeenCalled();
            expect(options.geometries).toHaveLength(2);
            expect(options.runtimeParts[0]?.picker?.matrixAutoUpdate).toBe(
                false,
            );
            expect(options.runtimeParts[0]?.picker?.geometry).toBe(
                options.geometries[0],
            );
            expect(
                options.geometries[0]?.getAttribute("normal").normalized,
            ).toBe(true);
            expect(
                options.geometries[0]?.getAttribute("partIndex"),
            ).toBeUndefined();
            expect(
                Array.from(
                    options.geometries[1]?.getAttribute("partIndex").array ??
                        [],
                ),
            ).toEqual([0, 0, 0]);
            expect(options.scene.children[0]?.userData.partIndices).toEqual([
                0,
            ]);
            const raycaster = new THREE.Raycaster(
                new THREE.Vector3(0.2, 0.2, 1),
                new THREE.Vector3(0, 0, -1),
            );
            expect(
                raycaster.intersectObject(options.runtimeParts[0]!.picker!),
            ).toHaveLength(1);
            expect(options.scene.children).toHaveLength(1);
            expect(options.scene.children[0]?.frustumCulled).toBe(false);
        } finally {
            dispose();
        }
    });

    it("limits in-flight downloads to one and ignores completions after cancellation", async () => {
        const pending: ((response: Response) => void)[] = [];
        const fetch = vi.fn<typeof globalThis.fetch>(
            () => new Promise<Response>((resolve) => pending.push(resolve)),
        );
        vi.stubGlobal("fetch", fetch);
        const { options, controller, dispose } = setup([], 5);
        try {
            const loading = loadGeometry(options);
            expect(fetch).toHaveBeenCalledTimes(1);
            controller.abort();
            pending.forEach((resolve) =>
                resolve(new Response(new ArrayBuffer(0))),
            );
            await loading;
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(options.onChunkLoaded).not.toHaveBeenCalled();
            expect(options.onReady).not.toHaveBeenCalled();
            expect(options.onError).not.toHaveBeenCalled();
            expect(options.geometries).toEqual([]);
        } finally {
            dispose();
        }
    });

    it("reports one loading error and aborts sibling work", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn<typeof globalThis.fetch>()
                .mockRejectedValue(new Error("offline")),
        );
        const { options, controller, dispose } = setup([], 5);
        try {
            await loadGeometry(options);
            expect(options.onError).toHaveBeenCalledExactlyOnceWith("offline");
            expect(controller.signal.aborted).toBe(true);
            expect(options.onReady).not.toHaveBeenCalled();
            expect(options.onChunkLoaded).not.toHaveBeenCalled();
        } finally {
            dispose();
        }
    });

    it("completes empty atlases without downloads", async () => {
        const fetch = vi.fn<typeof globalThis.fetch>();
        vi.stubGlobal("fetch", fetch);
        const { options, dispose } = setup([], 0);
        try {
            await loadGeometry(options);
            expect(fetch).not.toHaveBeenCalled();
            expect(options.onReady).toHaveBeenCalledOnce();
            expect(options.onChunkLoaded).not.toHaveBeenCalled();
        } finally {
            dispose();
        }
    });
});
