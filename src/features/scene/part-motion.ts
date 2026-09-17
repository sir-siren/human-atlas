import * as THREE from "three";
import { SYSTEMS } from "../anatomy";
import type { SceneState, SystemId } from "../anatomy";
import type { RuntimePart } from "./scene.types";
import type { PartTextures } from "./part-materials";
import type { SceneMarkers } from "./create-markers";

const systemOffsets = new Map(
    SYSTEMS.map((system, index) => {
        const angle = (index / SYSTEMS.length) * Math.PI * 2;
        return [
            system.id,
            { x: Math.sin(angle) * 0.48, z: Math.cos(angle) * 0.48 },
        ] as const;
    }),
);

/**
 * Compute translation from the assembled position through system separation to an XY layout.
 *
 * Inputs and output use scene units. Supply an explosion extent in 0..1; it is not clamped.
 * Mutates and returns `output` when supplied, otherwise allocates a tuple. The center and
 * destination are borrowed and unchanged; the final layout places the center at Z=0.
 */
export function calculatePartOffset(
    c: THREE.Vector3,
    dest: THREE.Vector3,
    systemId: SystemId,
    extent: number,
    output: [number, number, number] = [0, 0, 0],
): readonly [number, number, number] {
    const group = systemOffsets.get(systemId)!;
    let deltaX = 0;
    let deltaY = 0;
    let deltaZ = 0;

    if (extent <= 0.45) {
        const progress = extent / 0.45;
        deltaX = group.x * progress;
        deltaY = (c.y - 0.85) * progress * 0.28;
        deltaZ = group.z * progress;
    } else {
        const progress = (extent - 0.45) / 0.55;
        deltaX = THREE.MathUtils.lerp(group.x, dest.x - c.x, progress);
        deltaY = THREE.MathUtils.lerp(
            (c.y - 0.85) * 0.28,
            dest.y - c.y,
            progress,
        );
        deltaZ = THREE.MathUtils.lerp(group.z, -c.z, progress);
    }
    output[0] = deltaX;
    output[1] = deltaY;
    output[2] = deltaZ;
    return output;
}

/**
 * Update part translations, picker matrices, texture data, and marker positions in place.
 *
 * Runtime parts, texture slots, and marker slots must share atlas order and capacity.
 * `currentExplodeAmount` is a 0..1 fraction. Upload flags are set for the changed buffers.
 * @param membershipChanged - Set true after visibility, selection, or isolation changes;
 * false reuses cached membership and leaves selection data untouched.
 */
export function updatePartMotion(
    runtimeParts: readonly RuntimePart[],
    currentState: SceneState,
    currentExplodeAmount: number,
    textures: PartTextures,
    markerLayer: SceneMarkers,
    membershipChanged = true,
): void {
    const visibleSystemsSet = membershipChanged
        ? new Set(currentState.visible)
        : undefined;
    const selectedPartsSet = membershipChanged
        ? new Set(currentState.selected)
        : undefined;
    const offset: [number, number, number] = [0, 0, 0];
    const { stateData, selectedData, partTexture, selectionTexture } = textures;
    const { markerPositions, markerAttribute } = markerLayer;
    runtimeParts.forEach((runtime, index) => {
        const p = runtime.part;
        const c = runtime.center;
        const [deltaX, deltaY, deltaZ] = calculatePartOffset(
            c,
            runtime.destination,
            p.system,
            currentExplodeAmount,
            offset,
        );

        if (visibleSystemsSet && selectedPartsSet) {
            const isPartSelected = selectedPartsSet.has(p.id);
            runtime.visible = currentState.isolate
                ? isPartSelected
                : visibleSystemsSet.has(p.system) || isPartSelected;
            selectedData[index * 4] = isPartSelected ? 255 : 0;
        }
        runtime.offset.set(deltaX, deltaY, deltaZ);
        stateData[index * 4] = deltaX;
        stateData[index * 4 + 1] = deltaY;
        stateData[index * 4 + 2] = deltaZ;
        stateData[index * 4 + 3] = runtime.visible ? 1 : 0;
        markerPositions[index * 3] = runtime.visible ? c.x + deltaX : 10000;
        markerPositions[index * 3 + 1] = runtime.visible ? c.y + deltaY : 10000;
        markerPositions[index * 3 + 2] = runtime.visible ? c.z + deltaZ : 10000;

        const pickerMesh = runtime.picker;
        if (pickerMesh) {
            pickerMesh.position.copy(runtime.offset);
            pickerMesh.updateMatrix();
            pickerMesh.updateMatrixWorld(true);
        }
    });

    partTexture.needsUpdate = true;
    if (membershipChanged) selectionTexture.needsUpdate = true;
    markerAttribute.needsUpdate = true;
}
