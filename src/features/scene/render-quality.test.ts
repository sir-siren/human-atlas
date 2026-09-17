import { expect, it } from "vitest";
import * as THREE from "three";
import {
    checkSceneCapabilities,
    parseRenderQuality,
    RENDER_PROFILES,
} from "./render-quality";
import { createPartTextures, createSystemMaterials } from "./part-materials";
import { createStage } from "./create-stage";

it("defaults to low and rejects unsupported state texture capabilities", () => {
    expect(parseRenderQuality(null)).toBe("low");
    expect(parseRenderQuality("invalid")).toBe("low");
    expect(parseRenderQuality("high")).toBe("high");
    expect(RENDER_PROFILES.low).toEqual({
        antialias: false,
        dpr: 1,
        environment: false,
        decorations: false,
    });
    expect(() => checkSceneCapabilities(2234, 4096, 16)).not.toThrow();
    expect(() => checkSceneCapabilities(2234, 2048, 16)).toThrow(
        /state textures/,
    );
    expect(() => checkSceneCapabilities(1, 4096, 1)).toThrow(/state textures/);
});

it("uses identical anatomy materials and colors across all quality levels", () => {
    const textures = createPartTextures(2);
    const materials: THREE.Material[] = [];
    try {
        const profiles = (["low", "balanced", "high"] as const).map((quality) =>
            createSystemMaterials(textures, materials, quality),
        );
        const snapshots = profiles.map((systems) =>
            [...systems].map(([id, material]) => ({
                id,
                type: material.type,
                color: material.color.getHex(),
                opacity: material.opacity,
                transparent: material.transparent,
                side: material.side,
                depthWrite: material.depthWrite,
            })),
        );
        expect(snapshots[1]).toEqual(snapshots[0]);
        expect(snapshots[2]).toEqual(snapshots[0]);
    } finally {
        materials.forEach((material) => material.dispose());
        textures.partTexture.dispose();
        textures.selectionTexture.dispose();
    }
});

it("keeps renderer color settings and anatomy lighting identical across profiles", () => {
    const snapshots = (["low", "balanced", "high"] as const).map((quality) => {
        const container = document.createElement("div");
        const renderer = {
            domElement: document.createElement("canvas"),
            setPixelRatio: (_ratio: number) => undefined,
            setClearColor: (_color: string) => undefined,
        } as unknown as THREE.WebGLRenderer;
        const stage = createStage(
            renderer,
            container,
            () => undefined,
            quality,
        );
        try {
            expect(stage.geometries).toHaveLength(quality === "low" ? 0 : 4);
            expect(stage.materials).toHaveLength(quality === "low" ? 0 : 4);
            expect(
                stage.scene.children.filter(
                    (child) => child instanceof THREE.Mesh,
                ),
            ).toHaveLength(quality === "low" ? 0 : 4);
            return {
                colorSpace: renderer.outputColorSpace,
                toneMapping: renderer.toneMapping,
                exposure: renderer.toneMappingExposure,
                environment: stage.scene.environment,
                lights: stage.scene.children
                    .filter((child) => child instanceof THREE.Light)
                    .map((light) => ({
                        type: light.type,
                        color: light.color.getHex(),
                        groundColor:
                            light instanceof THREE.HemisphereLight
                                ? light.groundColor.getHex()
                                : undefined,
                        intensity: light.intensity,
                        position: light.position.toArray(),
                    })),
            };
        } finally {
            stage.controls.dispose();
            stage.geometries.forEach((geometry) => geometry.dispose());
            stage.materials.forEach((material) => material.dispose());
            container.remove();
        }
    });
    expect(snapshots[0]?.environment).toBeNull();
    expect(snapshots[1]).toEqual(snapshots[0]);
    expect(snapshots[2]).toEqual(snapshots[0]);
});

it("keeps visibility, selection, double-sided surfaces and skin transparency in low materials", () => {
    const textures = createPartTextures(2);
    const materials: THREE.Material[] = [];
    const systems = createSystemMaterials(textures, materials, "low");
    const material = systems.get("skeletal")!;
    expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(systems.get("integumentary")?.opacity).toBe(0.1);
    const shader = {
        uniforms: {},
        vertexShader: "#include <begin_vertex>",
        fragmentShader:
            "#include <clipping_planes_fragment>\n#include <color_fragment>",
    } as unknown as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain("transformed += state.xyz");
    expect(shader.vertexShader).toContain("selectionState");
    expect(shader.fragmentShader).toContain("if (partVisible < 0.5) discard");
    expect(shader.fragmentShader).toContain("partSelected * 0.75");
    materials.forEach((item) => item.dispose());
    textures.partTexture.dispose();
    textures.selectionTexture.dispose();
});
