import { useEffect, useState } from "react";
import {
    parseRenderQuality,
    QUALITY_STORAGE_KEY,
    type RenderQuality,
} from "../scene/render-quality";

/**
 * Synchronize a quality choice with local storage and the root render-quality data attribute.
 *
 * Missing/invalid storage defaults to low; storage failures leave the in-memory choice usable.
 * Mount one owner per document: cleanup deletes the shared root attribute, not the stored choice.
 */
export function useRenderQuality() {
    const [quality, setQuality] = useState<RenderQuality>(() => {
        try {
            return parseRenderQuality(
                localStorage.getItem(QUALITY_STORAGE_KEY),
            );
        } catch {
            return "low";
        }
    });
    useEffect(() => {
        document.documentElement.dataset.renderQuality = quality;
        try {
            localStorage.setItem(QUALITY_STORAGE_KEY, quality);
        } catch {
            // The in-memory choice remains usable when storage is blocked or full.
        }
        return () => {
            delete document.documentElement.dataset.renderQuality;
        };
    }, [quality]);
    return { quality, setQuality };
}
