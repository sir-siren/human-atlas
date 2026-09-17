import { useEffect, useState } from "react";
import type { Atlas } from "../anatomy";
import { fetchAtlasCatalogue } from "../api/atlas-catalogue";

interface AtlasCatalogue {
    readonly atlas: Atlas | null;
    readonly progress: number;
    readonly errorMessage: string;
    readonly onProgress: (percent: number) => void;
    readonly onError: (message: string) => void;
}

/**
 * Fetch the catalogue on mount and expose shared loading/error state for the scene.
 *
 * Aborts the request on unmount and ignores AbortError rejections. Progress is supplied by
 * the scene in percent (0..100), not by catalogue fetch; reporting 100 clears any error.
 * Non-abort Error rejections populate `errorMessage` rather than escaping the hook.
 */
export function useAtlasCatalogue(): AtlasCatalogue {
    const [atlas, setAtlas] = useState<Atlas | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>("");
    useEffect(() => {
        const controller = new AbortController();

        fetchAtlasCatalogue(controller.signal)
            .then((data) => {
                setAtlas(data);
            })
            .catch((err: unknown) => {
                if (err instanceof Error && err.name !== "AbortError") {
                    setErrorMessage(err.message);
                }
            });

        return (): void => {
            controller.abort();
        };
    }, []);

    const onProgress = (percent: number): void => {
        setProgress(percent);
        if (percent === 100) setErrorMessage("");
    };
    return {
        atlas,
        progress,
        errorMessage,
        onProgress,
        onError: setErrorMessage,
    };
}
