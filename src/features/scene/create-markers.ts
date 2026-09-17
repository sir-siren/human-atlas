import * as THREE from "three";

/**
 * Attach an initially hidden point layer with one position slot per atlas part.
 *
 * Supply a nonnegative integer count. The caller updates positions in atlas order, marks the
 * attribute for upload, and removes the layer and disposes its geometry/material on teardown.
 */
export function createMarkers(partCount: number, scene: THREE.Scene) {
    const markerPositions = new Float32Array(partCount * 3);
    const markerGeometry = new THREE.BufferGeometry();
    const markerAttribute = new THREE.BufferAttribute(markerPositions, 3);
    markerGeometry.setAttribute("position", markerAttribute);

    const markerMaterial = new THREE.PointsMaterial({
        color: 0x64748b,
        size: 5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.72,
        depthTest: false,
    });
    markerMaterial.onBeforeCompile = (shader): void => {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <clipping_planes_fragment>",
            "#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
        );
    };

    const markers = new THREE.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);
    return {
        markerPositions,
        markerGeometry,
        markerAttribute,
        markerMaterial,
        markers,
    };
}

export type SceneMarkers = ReturnType<typeof createMarkers>;
