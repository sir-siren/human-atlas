import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAtlasCatalogue } from "./useAtlasCatalogue";

const atlas = {
    version: "test",
    parts: [],
    concepts: [],
    chunks: [],
    triangles: 0,
};

describe("atlas catalogue lifecycle", () => {
    let root: Root;
    let current: ReturnType<typeof useAtlasCatalogue> | undefined;
    const fetchMock = vi.fn<typeof fetch>();

    function Harness(): ReactNode {
        const value = useAtlasCatalogue();
        useLayoutEffect(() => {
            current = value;
        });
        return null;
    }

    function state(): ReturnType<typeof useAtlasCatalogue> {
        if (!current) throw new Error("Hook has not rendered");
        return current;
    }

    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal("fetch", fetchMock);
        root = createRoot(document.createElement("div"));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
        current = undefined;
    });

    it("loads the catalogue with a cancellable request and clears errors only at full progress", async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(atlas)));
        await act(async () => root.render(<Harness />));
        expect(state().atlas).toEqual(atlas);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const call = fetchMock.mock.calls[0];
        expect(call?.[0]).toBe("/models/male/atlas.json");
        const signal = call?.[1]?.signal;
        expect(signal?.aborted).toBe(false);
        await act(async () => {
            state().onError("Geometry unavailable");
            state().onProgress(99);
        });
        expect(state().errorMessage).toBe("Geometry unavailable");
        expect(state().progress).toBe(99);
        await act(async () => state().onProgress(100));
        expect(state().errorMessage).toBe("");
        await act(async () => root.unmount());
        expect(signal?.aborted).toBe(true);
    });

    it("reports catalogue HTTP errors with the existing message", async () => {
        fetchMock.mockResolvedValue(
            new Response("Unavailable", { status: 503 }),
        );
        await act(async () => root.render(<Harness />));
        expect(state().atlas).toBeNull();
        expect(state().errorMessage).toBe(
            "The anatomy catalogue could not be loaded.",
        );
    });

    it.each([
        [new Error("Network failure"), "Network failure"],
        [new DOMException("Cancelled", "AbortError"), ""],
        ["non-Error rejection", ""],
    ])("preserves rejection handling for %s", async (error, message) => {
        fetchMock.mockRejectedValue(error);
        await act(async () => root.render(<Harness />));
        expect(state().errorMessage).toBe(message);
    });
});
