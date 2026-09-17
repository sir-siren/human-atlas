import * as THREE from "three";
import type { RuntimePart } from "./scene.types";

export interface TargetItem {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}

/**
 * Choose a target by rectangle distance with a small center-distance tie preference.
 *
 * Coordinates and radius are container-local CSS pixels. Returns the target's runtime-part
 * index, or -1 if none is within the radius. Use a nonnegative radius; exact score ties keep
 * the first target.
 */
export function findScreenTarget(
    screenTargets: readonly TargetItem[],
    screenX: number,
    screenY: number,
    searchRadius: number,
): number {
    let bestIndex = -1;
    let lowestScore = Infinity;

    for (const target of screenTargets) {
        const deltaX = Math.max(
            target.left - screenX,
            0,
            screenX - target.right,
        );
        const deltaY = Math.max(
            target.top - screenY,
            0,
            screenY - target.bottom,
        );
        const dist = Math.hypot(deltaX, deltaY);
        if (dist > searchRadius) {
            continue;
        }
        const candidateScore =
            dist + Math.hypot(target.x - screenX, target.y - screenY) * 0.025;
        if (candidateScore < lowestScore) {
            lowestScore = candidateScore;
            bestIndex = target.index;
        }
    }

    return bestIndex;
}

/**
 * Cache projected part bounds for exploded-layout picking without owning scene resources.
 *
 * Call `resize` with CSS-pixel dimensions, then `update` after camera or part transforms change
 * and before `find`. Camera matrices must be current. Updates clear targets at explosion
 * amounts at or below 0.45 and omit skin while any solid part is visible.
 */
export function createScreenTargets() {
    const screenTargets: TargetItem[] = [];
    const records: { -readonly [Key in keyof TargetItem]: TargetItem[Key] }[] =
        [];
    const projectedVector = new THREE.Vector3();
    let width = 0;
    let height = 0;

    return {
        resize(nextWidth: number, nextHeight: number): void {
            width = nextWidth;
            height = nextHeight;
        },
        find(screenX: number, screenY: number, searchRadius: number): number {
            return findScreenTarget(
                screenTargets,
                screenX,
                screenY,
                searchRadius,
            );
        },
        update(
            runtimeParts: readonly RuntimePart[],
            camera: THREE.PerspectiveCamera,
            container: HTMLDivElement,
            currentExplodeAmount: number,
        ): void {
            screenTargets.length = 0;
            if (!width || !height) {
                width = container.clientWidth;
                height = container.clientHeight;
            }
            if (currentExplodeAmount > 0.45) {
                const hasSolid = runtimeParts.some(
                    (r) => r.part.system !== "integumentary" && r.visible,
                );

                runtimeParts.forEach((r, idx) => {
                    if (
                        !r.visible ||
                        (hasSolid && r.part.system === "integumentary")
                    ) {
                        return;
                    }

                    let minX = Infinity;
                    let maxX = -Infinity;
                    let minY = Infinity;
                    let maxY = -Infinity;

                    for (let corner = 0; corner < 8; corner++) {
                        projectedVector
                            .set(
                                corner & 1 ? r.bounds.max.x : r.bounds.min.x,
                                corner & 2 ? r.bounds.max.y : r.bounds.min.y,
                                corner & 4 ? r.bounds.max.z : r.bounds.min.z,
                            )
                            .add(r.offset)
                            .project(camera);

                        const screenX = ((projectedVector.x + 1) * width) / 2;
                        const screenY = ((1 - projectedVector.y) * height) / 2;

                        minX = Math.min(minX, screenX);
                        maxX = Math.max(maxX, screenX);
                        minY = Math.min(minY, screenY);
                        maxY = Math.max(maxY, screenY);
                    }

                    projectedVector
                        .copy(r.center)
                        .add(r.offset)
                        .project(camera);
                    if (projectedVector.z < -1 || projectedVector.z > 1) {
                        return;
                    }

                    const target = records[idx] ?? {
                        index: idx,
                        x: 0,
                        y: 0,
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                    };
                    records[idx] = target;
                    target.x = ((projectedVector.x + 1) * width) / 2;
                    target.y = ((1 - projectedVector.y) * height) / 2;
                    target.left = minX;
                    target.right = maxX;
                    target.top = minY;
                    target.bottom = maxY;
                    screenTargets.push(target);
                });
            }
        },
    };
}

export type ScreenTargets = ReturnType<typeof createScreenTargets>;
