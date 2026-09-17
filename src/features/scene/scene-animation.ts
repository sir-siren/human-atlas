import * as THREE from "three";
import { createExplosionLayout } from "../explosion-layout";
import { createCameraFraming } from "./camera-framing";
import { updatePartMotion } from "./part-motion";
import type { Atlas, SceneState } from "../anatomy";
import type { RuntimePart } from "./scene.types";
import type { SceneStage } from "./create-stage";
import type { PartTextures } from "./part-materials";
import type { SceneMarkers } from "./create-markers";

interface SceneAnimationOptions {
    readonly atlas: Atlas;
    readonly container: HTMLDivElement;
    readonly stage: Pick<
        SceneStage,
        "camera" | "controls" | "ground" | "platform" | "ring" | "innerRing"
    >;
    readonly runtimeParts: readonly RuntimePart[];
    readonly textures: PartTextures;
    readonly markerLayer: SceneMarkers;
    readonly invalidate: () => void;
}

/**
 * Coordinate explosion, visibility, camera framing, and controls for borrowed scene resources.
 *
 * Replace state arrays instead of mutating them: membership changes use reference equality.
 * Call the invalidators after loading parts or resizing; this controller owns no frame loop
 * or disposable resources. Runtime parts, texture slots, and markers must share atlas order.
 */
export function createSceneAnimation({
    atlas,
    container,
    stage,
    runtimeParts,
    textures,
    markerLayer,
    invalidate,
}: SceneAnimationOptions) {
    const { camera, controls, ground, platform, ring, innerRing } = stage;
    const { markers } = markerLayer;
    let lastView = "";
    let lastReset = -1;
    let lastIsolate = "";
    let layoutDirty = true;
    let currentExplodeAmount = 0;
    let lastState: SceneState | null = null;
    let packingWidth = 1;
    let packingHeight = 1;
    let lastRenderedExtent = -1;

    const framing = createCameraFraming(container, camera, controls, () => {
        invalidate();
    });
    const fitCamera = (viewName: string, extent = 0): void => {
        framing.fit(viewName, extent, packingWidth, packingHeight);
    };

    return {
        /** Return the current interpolated explosion fraction, which may lag the state target. */
        get extent(): number {
            return currentExplodeAmount;
        },
        /** Force membership and part-state refresh on the next update after geometry loading. */
        invalidateParts(): void {
            lastState = null;
        },
        /** Force packing and part-state refresh on the next update after a viewport change. */
        invalidateLayout(): void {
            layoutDirty = true;
            lastState = null;
        },
        fit(viewName: string): void {
            fitCamera(viewName, currentExplodeAmount);
        },
        /**
         * Advance the scene by `deltaTime` seconds and report whether another frame is needed.
         *
         * Reduced motion snaps explosion and disables damping/auto-rotation. Mutates borrowed
         * camera, controls, part state, and GPU upload buffers, and requests invalidation.
         * @throws If explosion layout encounters missing or invalid XY bounds.
         */
        update(
            currentState: SceneState,
            deltaTime: number,
            reducedMotion = false,
        ): boolean {
            const hasStateChanged =
                lastState?.visible !== currentState.visible ||
                lastState?.selected !== currentState.selected ||
                lastState?.isolate !== currentState.isolate;

            const isAnimatingExplode =
                currentExplodeAmount !== currentState.explode;

            if (isAnimatingExplode) {
                currentExplodeAmount = reducedMotion
                    ? currentState.explode
                    : THREE.MathUtils.damp(
                          currentExplodeAmount,
                          currentState.explode,
                          8,
                          deltaTime,
                      );
                if (
                    Math.abs(currentExplodeAmount - currentState.explode) <=
                    0.0001
                ) {
                    currentExplodeAmount = currentState.explode;
                }
                invalidate();
            }

            if (
                hasStateChanged ||
                isAnimatingExplode ||
                lastRenderedExtent < 0
            ) {
                if (hasStateChanged || layoutDirty) {
                    const visibleSystemsSet = new Set(currentState.visible);
                    const selectedPartsSet = new Set(currentState.selected);

                    const visibleParts = atlas.parts.filter((p) =>
                        currentState.isolate
                            ? selectedPartsSet.has(p.id)
                            : visibleSystemsSet.has(p.system) ||
                              selectedPartsSet.has(p.id),
                    );

                    {
                        const layout = createExplosionLayout(
                            visibleParts,
                            camera.aspect,
                        );
                        packingWidth = layout.width;
                        packingHeight = layout.height;

                        runtimeParts.forEach((r) => {
                            const cell = layout.cells.get(r.part.id);
                            if (cell) {
                                r.destination.set(cell.x, cell.y + 0.85, 0);
                            } else {
                                r.destination.copy(r.center);
                            }
                        });

                        layoutDirty = false;
                        if (
                            currentExplodeAmount > 0.05 &&
                            !currentState.isolate
                        ) {
                            fitCamera(
                                currentState.view,
                                Math.max(0, (currentExplodeAmount - 0.3) / 0.7),
                            );
                        }
                    }
                }
                updatePartMotion(
                    runtimeParts,
                    currentState,
                    currentExplodeAmount,
                    textures,
                    markerLayer,
                    hasStateChanged,
                );
                lastState = currentState;
                lastRenderedExtent = currentExplodeAmount;
                invalidate();
            }

            if (
                currentState.view !== lastView ||
                currentState.reset !== lastReset
            ) {
                fitCamera(currentState.view, currentExplodeAmount);
                lastView = currentState.view;
                lastReset = currentState.reset;
            }

            if (isAnimatingExplode && !currentState.isolate) {
                fitCamera(
                    currentExplodeAmount > 0.5 ? "front" : currentState.view,
                    Math.max(0, (currentExplodeAmount - 0.3) / 0.7),
                );
            }

            const isolateKey = currentState.isolate
                ? `${currentState.selected.join(",")}:${currentState.reset}:${currentState.inspectorOpen}:${camera.aspect}:${currentState.view}`
                : "";

            if (
                isolateKey !== lastIsolate ||
                (currentState.isolate && isAnimatingExplode)
            ) {
                if (currentState.isolate) {
                    framing.fitIsolation(currentState, runtimeParts);
                } else if (lastIsolate) {
                    camera.clearViewOffset();
                    fitCamera(currentState.view, currentExplodeAmount);
                }
                lastIsolate = isolateKey;
            }

            controls.enableRotate = currentExplodeAmount < 0.8;
            controls.mouseButtons.LEFT =
                currentExplodeAmount < 0.8
                    ? THREE.MOUSE.ROTATE
                    : THREE.MOUSE.PAN;
            controls.touches.ONE =
                currentExplodeAmount < 0.8
                    ? THREE.TOUCH.ROTATE
                    : THREE.TOUCH.PAN;

            ground.visible =
                currentExplodeAmount < 0.5 && !currentState.isolate;
            platform.visible =
                currentExplodeAmount < 0.5 && !currentState.isolate;
            ring.visible = currentExplodeAmount < 0.5 && !currentState.isolate;
            innerRing.visible =
                currentExplodeAmount < 0.5 && !currentState.isolate;

            markers.visible = currentExplodeAmount > 0.75;
            controls.autoRotate =
                !reducedMotion &&
                currentState.rotate &&
                !currentState.isolate &&
                currentExplodeAmount < 0.4;
            controls.enableDamping = !reducedMotion;
            controls.autoRotateSpeed = 0.65;
            const controlsChanged = controls.update(deltaTime);

            if (controlsChanged || controls.autoRotate) invalidate();
            return (
                controlsChanged ||
                controls.autoRotate ||
                currentExplodeAmount !== currentState.explode
            );
        },
    };
}
