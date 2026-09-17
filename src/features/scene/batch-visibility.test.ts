import { expect, it } from "vitest";
import * as THREE from "three";
import { createBatchVisibility } from "./batch-visibility";
import type { RuntimePart } from "./scene.types";

it("hides only entirely invisible batches and notices arrivals", () => {
    const scene = new THREE.Scene();
    const parts = [{ visible: false }, { visible: true }] as RuntimePart[];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "partIndex",
        new THREE.Float32BufferAttribute([0, 0, 1], 1),
    );
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    const metadataGeometry = new THREE.BufferGeometry();
    const metadataMesh = new THREE.Mesh(
        metadataGeometry,
        new THREE.MeshBasicMaterial(),
    );
    metadataMesh.userData.partIndices = [0, 1];
    const batches = createBatchVisibility(scene, parts);
    batches.discover();
    scene.add(mesh, metadataMesh);
    batches.discover();
    batches.update();
    expect(mesh.visible).toBe(true);
    expect(metadataMesh.visible).toBe(true);
    parts[1]!.visible = false;
    batches.update();
    expect(mesh.visible).toBe(false);
    expect(metadataMesh.visible).toBe(false);
    parts[0]!.visible = true;
    batches.update();
    expect(mesh.visible).toBe(true);
    expect(metadataMesh.visible).toBe(true);
    geometry.dispose();
    metadataGeometry.dispose();
    mesh.material.dispose();
    metadataMesh.material.dispose();
});
