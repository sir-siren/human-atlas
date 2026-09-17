import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnatomyExplorer from "../features/AnatomyExplorer";
import type { Atlas, Part, SceneState } from "../features/anatomy";

const scene = vi.hoisted(() => ({
    props: undefined as
        | {
              state: SceneState;
              onSelect: (id: string) => void;
              onProgress: (percent: number) => void;
              onError: (message: string) => void;
          }
        | undefined,
}));

vi.mock("../features/AnatomyScene", () => ({
    default: (props: NonNullable<typeof scene.props>): null => {
        scene.props = props;
        return null;
    },
}));

const parts: Part[] = Array.from({ length: 52 }, (_, index) => ({
    id: `part-${index}`,
    name: `Heart piece ${index}`,
    conceptId: "heart",
    system: "cardiac",
    chunk: 0,
    positions: 0,
    normals: 0,
    indices: 0,
    vertexCount: 0,
    indexCount: 0,
    bounds: [
        [0, 0, 0],
        [1, 1, 1],
    ],
}));
const atlas: Atlas = {
    version: "test",
    parts,
    chunks: [],
    triangles: 0,
    concepts: [
        {
            id: "heart",
            name: "Heart",
            elements: [...parts.map((part) => part.id), "missing"],
        },
        { id: "brain", name: "Brain", elements: ["part-0"] },
    ],
};

describe("explorer presentation contracts", () => {
    let root: Root;
    let container: HTMLDivElement;

    function button(label: string): HTMLButtonElement {
        const found = Array.from(document.querySelectorAll("button")).find(
            (element) =>
                element.getAttribute("aria-label") === label ||
                element.textContent?.trim() === label,
        );
        if (!found) throw new Error(`Button missing: ${label}`);
        return found;
    }

    async function click(label: string): Promise<void> {
        await act(async () => button(label).click());
    }

    async function chooseHeart(): Promise<void> {
        await click("Search anatomy");
        const option = Array.from(
            document.querySelectorAll<HTMLElement>("[role=option]"),
        ).find((element) => element.textContent?.includes("Heart"));
        if (!option) throw new Error("Heart option missing");
        await act(async () => option.click());
    }

    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        vi.stubGlobal(
            "fetch",
            vi
                .fn<typeof fetch>()
                .mockResolvedValue(new Response(JSON.stringify(atlas))),
        );
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
        await act(async () => root.render(<AnatomyExplorer />));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
        scene.props = undefined;
    });

    it("retains loading and error announcements, with progress clearing the error at 100", async () => {
        expect(document.querySelector("[role=status]")?.textContent).toContain(
            "0% · Loading 52 pieces",
        );
        expect(
            document.querySelector("[role=status]")?.getAttribute("aria-live"),
        ).toBe("polite");
        await act(async () => scene.props?.onError("Model unavailable"));
        expect(document.querySelector("[role=status]")).toBeNull();
        expect(document.querySelector("[role=alert]")?.textContent).toContain(
            "Model unavailable",
        );
        expect(button("Reload viewer")).toBeDefined();
        await act(async () => scene.props?.onProgress(100));
        expect(document.querySelector("[role=alert]")).toBeNull();
        expect(document.querySelector("[role=status]")).toBeNull();
    });

    it("shows curated search options without additional filtering and opens nonmodal details", async () => {
        await click("Search anatomy");
        expect(
            document.querySelector(
                "[aria-label='Search named anatomical structures']",
            ),
        ).not.toBeNull();
        expect(
            Array.from(document.querySelectorAll("[role=option]")).map(
                (option) => option.textContent,
            ),
        ).toEqual(["Heart53 pieces", "Brain1 piece"]);
        await click("Close search");
        await chooseHeart();
        expect(document.querySelector(".search-panel")).toBeNull();
        expect(scene.props?.state.inspectorOpen).toBe(true);
        const dialog = document.querySelector("[role=dialog]");
        expect(dialog).not.toBeNull();
        expect(dialog?.getAttribute("aria-modal")).not.toBe("true");
        const title = document.querySelector(".structure-title");
        expect(title?.textContent).toBe("Heart");
        expect(title?.getAttribute("tabindex")).toBe("-1");
        expect(
            document.querySelector(".structure-meta")?.textContent,
        ).toContain("Selected pieces53");
        expect(document.querySelectorAll(".member-list button")).toHaveLength(
            50,
        );
        expect(document.querySelector(".member-list")?.textContent).toContain(
            "And 2 more modeled pieces.",
        );
        expect(document.querySelector(".context-note")).toBeNull();
        const source = document.querySelector(".source-link");
        expect(source?.getAttribute("href")).toBe(
            "https://lifesciencedb.jp/bp3d/",
        );
        expect(source?.getAttribute("rel")).toBe("noreferrer");
        await click("Heart piece 0");
        expect(scene.props?.state.selected).toEqual(["part-0"]);
        expect(document.querySelector(".member-list")).toBeNull();
        expect(document.querySelector(".context-note")?.textContent).toContain(
            "System overview",
        );
    });

    it("preserves isolated sheet styling, scroll remount, surrounding anatomy and clear actions", async () => {
        await chooseHeart();
        const scroll = document.querySelector(".detail-scroll");
        await click("Isolate structure");
        expect(scene.props?.state).toMatchObject({ isolate: true, explode: 0 });
        expect(
            document
                .querySelector(".detail-sheet")
                ?.classList.contains("is-isolated"),
        ).toBe(true);
        expect(document.querySelector(".detail-scroll")).not.toBe(scroll);
        expect(document.querySelector(".scene-caption")?.textContent).toBe(
            "Heart",
        );
        await click("Show surrounding anatomy");
        expect(scene.props?.state.isolate).toBe(false);
        await click("Clear selection");
        expect(scene.props?.state).toMatchObject({
            selected: [],
            isolate: false,
            inspectorOpen: false,
        });
    });

    it("routes layer presets and mobile controls without changing scene selection behavior", async () => {
        await click("Open system layers");
        expect(
            document
                .querySelector(".layers-panel")
                ?.classList.contains("mobile-open"),
        ).toBe(true);
        await click("Hide all");
        expect(scene.props?.state.visible).toEqual([]);
        expect(document.querySelector(".panel-foot")?.textContent).toContain(
            "0 pieces visible",
        );
        await click("All");
        expect(scene.props?.state.visible).toEqual(["cardiac"]);
        expect(button("All").getAttribute("aria-pressed")).toBe("true");
        await click("Organs");
        expect(scene.props?.state.visible).toEqual([
            "cardiac",
            "respiratory",
            "digestive",
            "urinary",
            "endocrine",
            "reproductive",
        ]);
        expect(button("Organs").getAttribute("aria-pressed")).toBe("true");
        await click("Close systems");
        expect(
            document
                .querySelector(".layers-panel")
                ?.classList.contains("mobile-open"),
        ).toBe(false);
    });

    it("opens source credits from both entry points and keeps source links", async () => {
        await click("About this atlas");
        expect(
            document.querySelector(".about-sheet .structure-title")
                ?.textContent,
        ).toBe("A body, revealed.");
        expect(
            document.querySelectorAll(
                ".about-copy a[target='_blank'][rel='noreferrer']",
            ),
        ).toHaveLength(3);
        await click("Close");
        await click("Source & credits");
        expect(document.querySelector(".about-sheet")).not.toBeNull();
    });
});
