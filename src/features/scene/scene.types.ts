import type * as THREE from "three";
import type { Atlas, Part, SceneState } from "../anatomy";
import type { RenderQuality } from "./render-quality";

export interface AnatomySceneProps {
    readonly atlas: Atlas;
    readonly quality?: RenderQuality;
    readonly state: SceneState;
    readonly onSelect: (id: string) => void;
    readonly onProgress: (progressPercentage: number) => void;
    readonly onError: (errorMessage: string) => void;
}

/**
 * Hold mutable render state for a borrowed catalogue part at the same atlas index.
 *
 * Bounds stay in unshifted scene coordinates; offset translates them for picking and projection.
 * Readonly vector fields prevent replacement, not mutation. Picker geometry is caller-owned.
 */
export interface RuntimePart {
    readonly part: Part;
    readonly bounds: THREE.Box3;
    readonly center: THREE.Vector3;
    readonly destination: THREE.Vector3;
    readonly offset: THREE.Vector3;
    visible: boolean;
    picker?: THREE.Mesh;
}
