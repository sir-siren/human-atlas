import { act, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AtlasTool } from "../agent-tools";
import { DEFAULT_VISIBLE, type Atlas, type Part } from "../anatomy";
import { useExplorerState } from "./useExplorerState";

const heart: Part = {
    id: "heart-part",
    name: "Heart piece",
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
};
const bone: Part = {
    ...heart,
    id: "bone-part",
    name: "Bone",
    conceptId: "bone",
    system: "skeletal",
};
const group = {
    id: "group",
    name: "Group",
    elements: [bone.id, "missing", heart.id],
};
const atlas: Atlas = {
    version: "test",
    parts: [heart, bone],
    concepts: [group],
    chunks: [],
    triangles: 0,
};

describe("explorer state contracts", () => {
    let root: Root;
    let container: HTMLDivElement;
    let current: ReturnType<typeof useExplorerState> | undefined;
    const registerTool =
        vi.fn<(tool: AtlasTool, options: { signal: AbortSignal }) => void>();

    function Harness({
        data = atlas,
    }: {
        readonly data?: Atlas | null;
    }): ReactNode {
        const value = useExplorerState(data);
        useLayoutEffect(() => {
            current = value;
        });
        return (
            <output>
                {value.isDetailsOpen ? value.chosenConcept?.name : "closed"}
            </output>
        );
    }

    function state(): ReturnType<typeof useExplorerState> {
        if (!current) throw new Error("Hook has not rendered");
        return current;
    }

    beforeEach(async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        Object.defineProperty(document, "modelContext", {
            configurable: true,
            value: { registerTool },
        });
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
        await act(async () => root.render(<Harness />));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        Reflect.deleteProperty(document, "modelContext");
        vi.unstubAllGlobals();
        current = undefined;
    });

    it("resets scene and selection but retains search text and the open about sheet", async () => {
        await act(async () => {
            state().setSearchQuery("heart");
            state().handleChooseConcept(group);
            state().handleViewChange("back");
            state().handleExplodeChange(90);
            state().handleOpenAbout();
        });
        const previousReset = state().sceneState.reset;
        await act(async () => state().handleResetScene());
        expect(state().sceneState).toEqual({
            explode: 0,
            visible: DEFAULT_VISIBLE,
            selected: [],
            isolate: false,
            view: "three-quarter",
            rotate: false,
            reset: previousReset + 1,
        });
        expect(state().chosenConcept).toBeNull();
        expect(state().isDetailsOpen).toBe(false);
        expect(state().activePanel).toBeNull();
        expect(state().searchQuery).toBe("heart");
        expect(state().isAboutOpen).toBe(true);
    });

    it("preserves selection order, missing IDs, visibility union and isolation counts", async () => {
        await act(async () => state().handleShowSystems([]));
        expect(state().visiblePartCount).toBe(0);
        await act(async () => state().handleChooseConcept(group));
        expect(state().sceneState.selected).toBe(group.elements);
        expect(state().selectedParts).toEqual([bone, heart]);
        expect(state().visiblePartCount).toBe(2);
        await act(async () => state().handleToggleIsolate());
        expect(state().sceneState.isolate).toBe(true);
        expect(state().visiblePartCount).toBe(2);
        await act(async () => state().handleChoosePart(heart.id));
        expect(state().chosenConcept).toEqual({
            id: "heart",
            name: "Heart piece",
            elements: [heart.id],
        });
        expect(state().sceneState.isolate).toBe(false);
        expect(state().visiblePartCount).toBe(1);
        const previous = state();
        await act(async () => state().handleChoosePart("missing"));
        expect(state()).toBe(previous);
    });

    it("keeps presets distinct from switches and clears selection without changing explosion or rotation", async () => {
        await act(async () => state().handleChooseConcept(group));
        await act(async () => {
            state().handleExplodeChange(50);
            state().handleToggleRotate();
            state().handleShowSystems(["skeletal"]);
        });
        expect(state().isDetailsOpen).toBe(true);
        expect(state().sceneState).toMatchObject({
            selected: [],
            isolate: false,
            explode: 0.5,
            rotate: true,
        });
        await act(async () => state().handleToggleSystem("skeletal"));
        expect(state().isDetailsOpen).toBe(false);
        expect(state().sceneState.visible).toEqual([]);
        expect(state().chosenConcept).toBe(group);
        await act(async () => state().handleToggleSystem("cardiac"));
        expect(state().sceneState.visible).toEqual(["cardiac"]);
    });

    it("preserves the explosion threshold, view reset counter and isolation behavior", async () => {
        await act(async () => state().handleViewChange("side"));
        await act(async () => state().handleExplodeChange(80));
        expect(state().sceneState.view).toBe("side");
        await act(async () => state().handleExplodeChange(81));
        expect(state().sceneState.view).toBe("front");
        expect(state().sceneState.reset).toBe(1);
        await act(async () => state().handleToggleIsolate());
        expect(state().sceneState).toMatchObject({
            explode: 0,
            isolate: true,
            view: "front",
        });
        await act(async () => state().handleClearSelection());
        expect(state().sceneState.isolate).toBe(false);
        expect(state().isDetailsOpen).toBe(false);
    });

    it("toggles panels, closes details and excludes text fields from the slash shortcut", async () => {
        await act(async () => state().handleOpenPanel("layers"));
        expect(state().activePanel).toBe("layers");
        await act(async () => state().handleOpenPanel("layers"));
        expect(state().activePanel).toBeNull();
        await act(async () => state().handleChooseConcept(group));
        for (const tag of ["input", "textarea"]) {
            const input = document.createElement(tag);
            container.append(input);
            const event = new KeyboardEvent("keydown", {
                key: "/",
                bubbles: true,
                cancelable: true,
            });
            await act(async () => {
                input.dispatchEvent(event);
            });
            expect(event.defaultPrevented).toBe(false);
            expect(state().isDetailsOpen).toBe(true);
        }
        const shortcut = new KeyboardEvent("keydown", {
            key: "/",
            cancelable: true,
        });
        await act(async () => {
            window.dispatchEvent(shortcut);
        });
        expect(shortcut.defaultPrevented).toBe(true);
        expect(state().activePanel).toBe("search");
        expect(state().isDetailsOpen).toBe(false);
        await act(async () => root.unmount());
        const afterUnmount = new KeyboardEvent("keydown", {
            key: "/",
            cancelable: true,
        });
        window.dispatchEvent(afterUnmount);
        expect(afterUnmount.defaultPrevented).toBe(false);
    });

    it("registers tools per catalogue and commits inspection synchronously, then aborts on replacement", async () => {
        expect(registerTool).toHaveBeenCalledTimes(2);
        const registration = registerTool.mock.calls.find(
            ([tool]) => tool.name === "inspect_anatomical_structure",
        );
        if (!registration) throw new Error("Inspection tool missing");
        const [inspect, { signal }] = registration;
        act(() => {
            expect(inspect.execute({ id: "group" })).toEqual({
                id: "group",
                name: "Group",
                selectedPieces: 3,
            });
            expect(container.textContent).toBe("Group");
        });
        expect(registerTool).toHaveBeenCalledTimes(2);
        expect(signal.aborted).toBe(false);
        await act(async () => root.render(<Harness data={null} />));
        expect(signal.aborted).toBe(true);
        expect(state().selectedParts).toEqual([]);
        expect(state().visiblePartCount).toBe(0);
    });
});
