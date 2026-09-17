import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QUALITY_STORAGE_KEY } from "../scene/render-quality";
import { useRenderQuality } from "./useRenderQuality";

let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useRenderQuality>;

function Harness(): ReactNode {
    const value = useRenderQuality();
    useLayoutEffect(() => {
        current = value;
    });
    return <output>{value.quality}</output>;
}

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    container = document.createElement("div");
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
});

it("defaults to Low and persists changes across remounts", async () => {
    await act(async () => root.render(<Harness />));
    expect(current.quality).toBe("low");
    expect(document.documentElement.dataset.renderQuality).toBe("low");
    await act(async () => current.setQuality("high"));
    expect(localStorage.getItem(QUALITY_STORAGE_KEY)).toBe("high");
    await act(async () => root.unmount());
    expect(document.documentElement.dataset.renderQuality).toBeUndefined();
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    expect(current.quality).toBe("high");
    expect(document.documentElement.dataset.renderQuality).toBe("high");
});

it("restores Balanced and treats unknown stored profiles as Low", async () => {
    localStorage.setItem(QUALITY_STORAGE_KEY, "balanced");
    await act(async () => root.render(<Harness />));
    expect(current.quality).toBe("balanced");
    await act(async () => root.unmount());
    localStorage.setItem(QUALITY_STORAGE_KEY, "invalid");
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    expect(current.quality).toBe("low");
});

it("keeps the selector usable when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage blocked");
    });
    await act(async () => root.render(<Harness />));
    expect(current.quality).toBe("low");
    await act(async () => current.setQuality("balanced"));
    expect(current.quality).toBe("balanced");
    expect(document.documentElement.dataset.renderQuality).toBe("balanced");
});
