import * as THREE from "three";
import { PointerTap } from "../pointer-tap";
import type { Atlas } from "../anatomy";
import type { RuntimePart } from "./scene.types";
import type { ScreenTargets } from "./screen-targets";

interface ScenePickingOptions {
    readonly container: HTMLDivElement;
    readonly renderer: THREE.WebGLRenderer;
    readonly camera: THREE.PerspectiveCamera;
    readonly atlas: Atlas;
    readonly runtimeParts: readonly RuntimePart[];
    readonly hoverTooltip: HTMLDivElement;
    readonly screenTargets: ScreenTargets;
    readonly getExplodeAmount: () => number;
    readonly getIsReady: () => boolean;
    readonly onSelect: (id: string) => void;
}

/**
 * Connect tap selection and exploded-layout hover to caller-owned scene objects.
 *
 * Keep runtime parts in atlas order and screen targets current after camera or part motion.
 * Selection waits for readiness; visible solid parts take precedence over the body surface.
 * Mutates the tooltip and canvas cursor. Call the returned cleanup to remove canvas/window
 * listeners; it does not remove the tooltip or dispose meshes.
 */
export function connectScenePicking({
    container,
    renderer,
    camera,
    atlas,
    runtimeParts,
    hoverTooltip,
    screenTargets,
    getExplodeAmount,
    getIsReady,
    onSelect,
}: ScenePickingOptions): () => void {
    const raycaster = new THREE.Raycaster();
    const pointerCoords = new THREE.Vector2();
    const pointerTap = new PointerTap();
    const worldBox = new THREE.Box3();
    const hitPoint = new THREE.Vector3();

    const onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) {
            return;
        }
        hoverTooltip.hidden = true;
        pointerTap.down(
            event.pointerId,
            event.clientX,
            event.clientY,
            event.pointerType === "touch" ? 12 : 5,
        );
    };

    const onPointerMove = (event: PointerEvent): void => {
        pointerTap.move(event.pointerId, event.clientX, event.clientY);
        if (
            event.buttons ||
            getExplodeAmount() < 0.5 ||
            event.pointerType === "touch"
        ) {
            hoverTooltip.hidden = true;
            return;
        }

        const rect = container.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const targetIndex = screenTargets.find(localX, localY, 12);
        const matchedPart = atlas.parts[targetIndex];

        hoverTooltip.hidden = !matchedPart;
        renderer.domElement.style.cursor = matchedPart ? "pointer" : "grab";

        if (matchedPart) {
            hoverTooltip.textContent = matchedPart.name;
            hoverTooltip.style.left = `${Math.max(8, Math.min(localX + 14, container.clientWidth - 260))}px`;
            hoverTooltip.style.top = `${Math.max(8, Math.min(localY + 18, container.clientHeight - 55))}px`;
        }
    };

    const onPointerCancel = (event: PointerEvent): void => {
        pointerTap.cancel(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent): void => {
        const isCleanTap = pointerTap.up(
            event.pointerId,
            event.clientX,
            event.clientY,
        );
        if (!isCleanTap || !getIsReady()) {
            return;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
        ) {
            return;
        }

        pointerCoords.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointerCoords, camera);

        let nearestDistance = Infinity;
        let foundIndex = -1;
        const hasSolidMeshes = runtimeParts.some(
            (r) => r.part.system !== "integumentary" && r.visible,
        );

        runtimeParts.forEach((runtime, index) => {
            const mesh = runtime.picker;
            if (
                !mesh ||
                !runtime.visible ||
                (hasSolidMeshes && runtime.part.system === "integumentary")
            ) {
                return;
            }

            worldBox.copy(runtime.bounds).translate(mesh.position);
            if (!raycaster.ray.intersectBox(worldBox, hitPoint)) {
                return;
            }

            const hits = raycaster.intersectObject(mesh, false);
            const firstHit = hits[0];
            if (firstHit && firstHit.distance < nearestDistance) {
                nearestDistance = firstHit.distance;
                foundIndex = index;
            }
        });

        if (foundIndex < 0 && getExplodeAmount() > 0.45) {
            foundIndex = screenTargets.find(
                event.clientX - rect.left,
                event.clientY - rect.top,
                event.pointerType === "touch" ? 24 : 16,
            );
        }

        const selectedPart = atlas.parts[foundIndex];
        if (selectedPart) {
            hoverTooltip.hidden = true;
            onSelect(selectedPart.id);
        }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return (): void => {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
    };
}
