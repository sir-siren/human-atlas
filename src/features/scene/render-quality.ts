export type RenderQuality = "low" | "balanced" | "high";

export const QUALITY_STORAGE_KEY = "human-atlas:render-quality";

export const RENDER_PROFILES = {
    low: { antialias: false, dpr: 1, environment: false, decorations: false },
    balanced: {
        antialias: true,
        dpr: 1.5,
        environment: false,
        decorations: true,
    },
    high: { antialias: true, dpr: 2, environment: false, decorations: true },
} as const;

export function parseRenderQuality(value: unknown): RenderQuality {
    return value === "balanced" || value === "high" ? value : "low";
}

/**
 * Check whether per-part textures fit the device's texture width and vertex-sampler limits.
 *
 * Pass WebGL MAX_TEXTURE_SIZE and MAX_VERTEX_TEXTURE_IMAGE_UNITS, with a nonnegative integer
 * part count. This does not test allocation success or other WebGL capabilities.
 * @throws If the power-of-two state texture is too wide or fewer than two samplers are available.
 */
export function checkSceneCapabilities(
    partCount: number,
    maxTextureSize: number,
    maxVertexTextures: number,
): void {
    const width = 2 ** Math.ceil(Math.log2(Math.max(1, partCount)));
    if (width > maxTextureSize || maxVertexTextures < 2) {
        throw new Error(
            "This device cannot support the anatomy state textures. Search and structure details remain available.",
        );
    }
}
