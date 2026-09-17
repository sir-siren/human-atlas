import type { Atlas } from "../anatomy";

/**
 * Fetch catalogue JSON without runtime schema validation or geometry loading.
 *
 * @throws Rejects on a non-OK HTTP response, network/read/JSON errors, or signal cancellation.
 */
export function fetchAtlasCatalogue(signal: AbortSignal): Promise<Atlas> {
    return fetch("/models/atlas.json", { signal }).then((response) => {
        if (!response.ok) {
            throw new Error("The anatomy catalogue could not be loaded.");
        }
        return response.json() as Promise<Atlas>;
    });
}
