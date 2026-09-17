import * as THREE from "three";
import { SYSTEMS } from "../anatomy";
import type { SystemId } from "../anatomy";
import type { RenderQuality } from "./render-quality";

export type SystemMaterial =
    THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

/**
 * Allocate per-part translation/visibility and selection textures with writable backing arrays.
 *
 * Supply a nonnegative integer count after checking device limits. RGBA float slots store XYZ
 * offsets in scene units and visibility; the selection texture's red byte is 0 or 255.
 * Keep slots in atlas order and mark textures for upload after writes. The caller disposes both.
 */
export function createPartTextures(partCount: number) {
    const textureWidth = THREE.MathUtils.ceilPowerOfTwo(Math.max(1, partCount));
    const stateData = new Float32Array(textureWidth * 4);
    const partTexture = new THREE.DataTexture(
        stateData,
        textureWidth,
        1,
        THREE.RGBAFormat,
        THREE.FloatType,
    );
    partTexture.needsUpdate = true;

    const selectedData = new Uint8Array(textureWidth * 4);
    const selectionTexture = new THREE.DataTexture(
        selectedData,
        textureWidth,
        1,
    );
    selectionTexture.needsUpdate = true;
    return {
        textureWidth,
        stateData,
        partTexture,
        selectedData,
        selectionTexture,
    };
}

export type PartTextures = ReturnType<typeof createPartTextures>;

/**
 * Create system materials sampling the supplied per-part state textures.
 *
 * Mesh geometry must expose atlas-ordered `partIndex` values. Appends every new material to
 * the caller's disposal list; textures remain borrowed and need separate disposal. Quality
 * currently does not change the material implementation.
 */
export function createSystemMaterials(
    { textureWidth, partTexture, selectionTexture }: PartTextures,
    materials: THREE.Material[],
    _quality: RenderQuality = "low",
): Map<SystemId, SystemMaterial> {
    const createSystemMaterial = (systemId: SystemId): SystemMaterial => {
        const color =
            SYSTEMS.find((s) => s.id === systemId)?.color ?? "#aebbb8";
        const isSkin = systemId === "integumentary";

        const options = {
            color,
            side: THREE.DoubleSide,
            transparent: isSkin,
            opacity: isSkin ? 0.1 : 1,
            depthWrite: !isSkin,
        };
        const mat = new THREE.MeshLambertMaterial(options);

        mat.onBeforeCompile = (shader): void => {
            shader.uniforms["partState"] = { value: partTexture };
            shader.uniforms["selectionState"] = { value: selectionTexture };
            shader.uniforms["stateWidth"] = { value: textureWidth };

            shader.vertexShader =
                "attribute float partIndex;\n" +
                "uniform sampler2D partState;\n" +
                "uniform sampler2D selectionState;\n" +
                "uniform float stateWidth;\n" +
                "varying float partVisible;\n" +
                "varying float partSelected;\n" +
                shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\n" +
                    "vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);\n" +
                    "vec4 state = texture2D(partState, stateUv);\n" +
                    "transformed += state.xyz;\n" +
                    "partVisible = state.w;\n" +
                    "partSelected = texture2D(selectionState, stateUv).r;",
            );

            shader.fragmentShader =
                "varying float partVisible;\n" +
                "varying float partSelected;\n" +
                shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <clipping_planes_fragment>",
                "#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;",
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                "#include <color_fragment>",
                "#include <color_fragment>\n" +
                    "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);",
            );
        };

        materials.push(mat);
        return mat;
    };

    const systemMaterials = new Map<SystemId, SystemMaterial>();
    for (const sys of SYSTEMS) {
        systemMaterials.set(sys.id, createSystemMaterial(sys.id));
    }
    return systemMaterials;
}
