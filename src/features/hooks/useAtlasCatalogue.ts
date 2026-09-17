import { useEffect, useState } from "react";
import type { Atlas, ModelSex } from "../anatomy";
import { fetchAtlasCatalogue } from "../api/atlas-catalogue";

interface AtlasCatalogue {
    readonly atlas: Atlas | null;
    readonly progress: number;
    readonly errorMessage: string;
    readonly onProgress: (percent: number) => void;
    readonly onError: (message: string) => void;
}

/**
 * Fetch one model's catalogue and expose shared loading/error state for the scene.
 *
 * Mount with a key matching `sex` to reset state and release the previous model on a switch.
 *
 * Aborts the request on unmount and ignores AbortError rejections. Progress is supplied by
 * the scene in percent (0..100), not by catalogue fetch; reporting 100 clears any error.
 * Non-abort Error rejections populate `errorMessage` rather than escaping the hook.
 */
export function useAtlasCatalogue(sex: ModelSex = "male"): AtlasCatalogue {
    const [atlas, setAtlas] = useState<Atlas | null>(null);
    const [progress, setProgress] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>("");
    useEffect(() => {
        const controller = new AbortController();

        fetchAtlasCatalogue(controller.signal, sex)
            .then((data) => {
                if (!controller.signal.aborted) setAtlas(data);
            })
            .catch((err: unknown) => {
                if (
                    !controller.signal.aborted &&
                    err instanceof Error &&
                    err.name !== "AbortError"
                ) {
                    setErrorMessage(err.message);
                }
            });

        return (): void => {
            controller.abort();
        };
    }, [sex]);

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
