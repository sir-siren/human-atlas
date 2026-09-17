import * as THREE from "three";
import type { Part } from "../anatomy";
import type { RuntimePart } from "./scene.types";

/**
 * Allocate mutable scene state in input part order, borrowing each catalogue part.
 *
 * Bounds/vectors are new and use the catalogue's scene units. Missing bound components use
 * zero; malformed ranges are not validated. Parts start hidden without picker meshes.
 */
export function createRuntimeParts(parts: readonly Part[]): RuntimePart[] {
    return parts.map((part) => {
        const minArr = part.bounds[0] ?? [0, 0, 0];
        const maxArr = part.bounds[1] ?? [0, 0, 0];
        const minVec = new THREE.Vector3(
            minArr[0] ?? 0,
            minArr[1] ?? 0,
            minArr[2] ?? 0,
        );
        const maxVec = new THREE.Vector3(
            maxArr[0] ?? 0,
            maxArr[1] ?? 0,
            maxArr[2] ?? 0,
        );
        const bounds = new THREE.Box3(minVec, maxVec);
        const center = bounds.getCenter(new THREE.Vector3());

        return {
            part,
            bounds,
            center,
            destination: center.clone(),
            offset: new THREE.Vector3(),
            visible: false,
            picker: undefined,
        };
    });
}
