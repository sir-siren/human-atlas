import * as THREE from "three";
import { GeometryEngineClient } from "../../../engine/browser";
import type { Atlas, SystemId } from "../anatomy";
import type { RuntimePart } from "./scene.types";
import type { SystemMaterial } from "./part-materials";

interface GeometryLoadingOptions {
    readonly atlas: Atlas;
    readonly signal: AbortSignal;
    readonly shouldStop: () => boolean;
    readonly runtimeParts: readonly RuntimePart[];
    readonly geometries: THREE.BufferGeometry[];
    readonly pickerMaterial: THREE.MeshBasicMaterial;
    readonly systemMaterials: ReadonlyMap<SystemId, SystemMaterial>;
    readonly scene: THREE.Scene;
    readonly onChunkLoaded: (progress: number) => void;
    readonly onReady: () => void;
    readonly onError: (message: string) => void;
}

/**
 * Load chunks through a worker and attach prepared meshes to the scene.
 *
 * @remarks
 * Keep runtime parts in atlas order. Mutates their pickers and appends owned geometry to
 * `geometries`; the caller must dispose geometry/materials and detach scene meshes, including
 * partial results after failure. The worker is disposed when loading ends.
 * Progress is a rounded percentage of completed chunks, not downloaded bytes. Aborting or
 * `shouldStop()` suppresses later callbacks; non-abort loading errors go to `onError`.
 * The stop predicate is checked between asynchronous steps, not during mesh construction.
 *
 * @throws Rejects if worker-client construction fails before loading begins, or if `onError`
 * or worker disposal throws. Other callback errors are routed through the loading catch path.
 */
export async function loadGeometry({
    atlas,
    signal,
    shouldStop,
    runtimeParts,
    geometries,
    pickerMaterial,
    systemMaterials,
    scene,
    onChunkLoaded,
    onReady,
    onError,
}: GeometryLoadingOptions): Promise<void> {
    const engine = new GeometryEngineClient(signal);
    const stopped = (): boolean => signal.aborted || shouldStop();
    const systems = [...systemMaterials.keys()];
    try {
        for (
            let chunkIndex = 0;
            chunkIndex < atlas.chunks.length && !stopped();
            chunkIndex += 1
        ) {
            const chunk = atlas.chunks[chunkIndex];
            if (!chunk) throw new Error("An anatomy chunk is missing.");
            const parts = runtimeParts.flatMap((runtime, id) => {
                const part = runtime.part;
                if (part.chunk !== chunkIndex) return [];
                const system = systems.indexOf(part.system);
                if (system < 0)
                    throw new Error("An anatomy system is not supported.");
                return [
                    {
                        id,
                        system,
                        positions: part.positions,
                        normals: part.normals,
                        indices: part.indices,
                        vertexCount: part.vertexCount,
                        indexCount: part.indexCount,
                    },
                ];
            });
            const result = await engine.prepare({ ...chunk, parts });
            if (stopped()) return;
            for (const part of parts) {
                const runtime = runtimeParts[part.id]!;
                const geometry = new THREE.BufferGeometry();
                geometries.push(geometry);
                geometry.setAttribute(
                    "position",
                    new THREE.BufferAttribute(
                        new Float32Array(
                            result.source,
                            part.positions,
                            part.vertexCount * 3,
                        ),
                        3,
                    ),
                );
                geometry.setAttribute(
                    "normal",
                    new THREE.BufferAttribute(
                        new Int16Array(
                            result.source,
                            part.normals,
                            part.vertexCount * 3,
                        ),
                        3,
                        true,
                    ),
                );
                geometry.setIndex(
                    new THREE.BufferAttribute(
                        new Uint32Array(
                            result.source,
                            part.indices,
                            part.indexCount,
                        ),
                        1,
                    ),
                );
                geometry.boundingBox = runtime.bounds.clone();
                geometry.boundingSphere = runtime.bounds.getBoundingSphere(
                    new THREE.Sphere(),
                );
                const picker = new THREE.Mesh(geometry, pickerMaterial);
                picker.matrixAutoUpdate = false;
                runtime.picker = picker;
            }
            for (const batch of result.batches) {
                const material = systemMaterials.get(systems[batch.system]!)!;
                const geometry = new THREE.BufferGeometry();
                geometries.push(geometry);
                geometry.setAttribute(
                    "position",
                    new THREE.BufferAttribute(batch.positions, 3),
                );
                geometry.setAttribute(
                    "normal",
                    new THREE.BufferAttribute(batch.normals, 3, true),
                );
                geometry.setAttribute(
                    "partIndex",
                    new THREE.BufferAttribute(batch.partIndices, 1),
                );
                geometry.setIndex(new THREE.BufferAttribute(batch.indices, 1));
                const bounds = new THREE.Box3();
                for (let index = 0; index < batch.bounds.length; index += 6) {
                    bounds.expandByPoint(
                        new THREE.Vector3().fromArray(batch.bounds, index),
                    );
                    bounds.expandByPoint(
                        new THREE.Vector3().fromArray(batch.bounds, index + 3),
                    );
                }
                geometry.boundingBox = bounds;
                geometry.boundingSphere = bounds.getBoundingSphere(
                    new THREE.Sphere(),
                );
                const mesh = new THREE.Mesh(geometry, material);
                mesh.userData.partIndices = batch.partIds;
                mesh.frustumCulled = false;
                scene.add(mesh);
            }
            onChunkLoaded(
                Math.round(((chunkIndex + 1) / atlas.chunks.length) * 100),
            );
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        if (!stopped()) onReady();
    } catch (error) {
        if (!stopped())
            onError(
                error instanceof Error
                    ? error.message
                    : "Could not load the anatomy.",
            );
    } finally {
        engine.dispose();
    }
}
