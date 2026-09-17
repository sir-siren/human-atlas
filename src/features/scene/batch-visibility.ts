import * as THREE from "three";
import type { RuntimePart } from "./scene.types";

/**
 * Track direct child batch meshes and hide those with no visible member parts.
 *
 * Call `discover` after loading meshes, then `update` after refreshing runtime visibility.
 * Metadata and `partIndex` attributes must index `parts` in atlas order. Meshes are borrowed;
 * discoveries accumulate for this scene's lifetime and do not handle removal or reindexing.
 */
export function createBatchVisibility(
    scene: THREE.Scene,
    parts: readonly RuntimePart[],
) {
    const batches = new Map<THREE.Mesh, readonly number[]>();
    return {
        discover(): void {
            for (const child of scene.children) {
                if (!(child instanceof THREE.Mesh) || batches.has(child))
                    continue;
                const metadata = child.userData.partIndices as
                    readonly number[] | undefined;
                if (metadata) {
                    batches.set(child, metadata);
                    continue;
                }
                const attribute = child.geometry.getAttribute("partIndex");
                if (!attribute) continue;
                const indices = new Set<number>();
                for (let index = 0; index < attribute.count; index++)
                    indices.add(attribute.getX(index));
                batches.set(child, [...indices]);
            }
        },
        update(): void {
            for (const [mesh, indices] of batches) {
                mesh.visible = indices.some((index) => parts[index]?.visible);
            }
        },
    };
}
