import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneState } from "../anatomy";
import type { RuntimePart } from "./scene.types";

/**
 * Create framing operations that mutate a borrowed camera and orbit controls, then invalidate.
 *
 * `fit` accepts an explosion fraction (0..1) and layout dimensions in scene units.
 * `fitIsolation` frames selected bounds with their current offsets and reserves inspector space;
 * an empty selection leaves the camera unchanged. The caller must clear the camera view offset
 * when leaving isolation. Keep the camera aspect and container dimensions current.
 */
export function createCameraFraming(
    container: HTMLDivElement,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    invalidate: () => void,
) {
    const fit = (
        viewName: string,
        extent: number,
        packingWidth: number,
        packingHeight: number,
    ): void => {
        const isMobile = container.clientWidth < 768;
        const normalDistance = isMobile
            ? Math.max(
                  4.5,
                  (1.8 * container.clientHeight) /
                      Math.max(160, container.clientHeight - 350) /
                      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))),
              )
            : 4;

        const reservedHeight = isMobile ? 350 : 270;
        const availableAspect = Math.max(
            0.35,
            (container.clientWidth - (isMobile ? 40 : 340)) /
                Math.max(160, container.clientHeight - reservedHeight),
        );

        const atlasDistance =
            (Math.max(packingHeight, packingWidth / availableAspect) /
                (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
            (container.clientHeight /
                Math.max(160, container.clientHeight - reservedHeight)) *
            1.08;

        const targetDistance = THREE.MathUtils.lerp(
            normalDistance,
            Math.max(0.2, atlasDistance),
            extent,
        );

        let effectiveView = viewName;
        if (extent > 0.8) {
            effectiveView = "front";
        }

        let direction: THREE.Vector3;
        switch (effectiveView) {
            case "front":
                direction = new THREE.Vector3(0, 0.02, 1);
                break;
            case "back":
                direction = new THREE.Vector3(0, 0.02, -1);
                break;
            case "side":
                direction = new THREE.Vector3(1, 0.02, 0);
                break;
            default:
                direction = new THREE.Vector3(0.35, 0.06, 1).normalize();
                break;
        }

        controls.target.set(
            extent > 0.1 && container.clientWidth > 767
                ? -packingWidth * 0.12
                : 0,
            extent > 0.1 || isMobile ? 0.85 : 0.68,
            0,
        );

        camera.position
            .copy(controls.target)
            .addScaledVector(direction, targetDistance);
        controls.update();
        invalidate();
    };

    const fitIsolation = (
        currentState: SceneState,
        runtimeParts: readonly RuntimePart[],
    ): void => {
        const isolationBox = new THREE.Box3();
        runtimeParts.forEach((r) => {
            if (currentState.selected.includes(r.part.id)) {
                isolationBox.union(r.bounds.clone().translate(r.offset));
            }
        });

        if (!isolationBox.isEmpty()) {
            const center = isolationBox.getCenter(new THREE.Vector3());
            const size = isolationBox.getSize(new THREE.Vector3());
            const viewportWidth = container.clientWidth;
            const viewportHeight = container.clientHeight;
            const isMobile = viewportWidth < 768;
            const isLandscape =
                viewportWidth > viewportHeight && viewportHeight <= 600;

            let insetLeft = 20;
            let insetRight = viewportWidth - 20;
            let insetTop = isMobile ? 175 : 110;
            let insetBottom = viewportHeight - 170;

            if (currentState.inspectorOpen) {
                if (isLandscape) {
                    insetRight = viewportWidth - 335;
                    insetTop = 100;
                    insetBottom = viewportHeight - 125;
                } else if (isMobile) {
                    const sheetEl = document.querySelector(".detail-sheet");
                    const headerEl = document.querySelector(".identity");
                    const sheetRect = sheetEl?.getBoundingClientRect();
                    const headerRect = headerEl?.getBoundingClientRect();
                    insetTop = (headerRect?.bottom ?? 94) + 16;
                    insetBottom =
                        (sheetRect?.top ?? viewportHeight * 0.58 - 139) - 16;
                } else {
                    insetRight = viewportWidth - 370;
                    insetLeft = viewportWidth > 1100 ? 285 : 25;
                }
            }

            const availableWidth = Math.max(150, insetRight - insetLeft);
            const availableHeight = Math.max(40, insetBottom - insetTop);

            camera.setViewOffset(
                viewportWidth,
                viewportHeight,
                viewportWidth / 2 - (insetLeft + insetRight) / 2,
                viewportHeight / 2 - (insetTop + insetBottom) / 2,
                viewportWidth,
                viewportHeight,
            );

            const distance = Math.max(
                0.07,
                (Math.max(
                    (size.y * viewportHeight) / availableHeight,
                    (size.x * viewportWidth) / availableWidth / camera.aspect,
                    size.z,
                ) /
                    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
                    1.35,
            );

            controls.maxDistance = Math.max(40, distance * 2);
            controls.target.copy(center);
            camera.position
                .copy(center)
                .add(
                    new THREE.Vector3(0.2, 0.1, 1)
                        .normalize()
                        .multiplyScalar(distance),
                );
            controls.update();
            invalidate();
        }
    };

    return { fit, fitIsolation };
}
