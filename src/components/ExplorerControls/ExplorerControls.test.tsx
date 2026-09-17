import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerControls } from "./ExplorerControls";

describe("explorer camera and explosion controls", () => {
    let root: Root;
    let container: HTMLDivElement;
    const onViewChange = vi.fn<(view: string) => void>();
    const onToggleRotate = vi.fn<() => void>();
    const onExplodeChange = vi.fn<(percent: number) => void>();
    const onReset = vi.fn<() => void>();
    const onOpenLayers = vi.fn<() => void>();
    const onOpenAbout = vi.fn<() => void>();

    async function render(
        explode: number,
        isolate = false,
        rotate = false,
    ): Promise<void> {
        await act(async () =>
            root.render(
                <ExplorerControls
                    view="side"
                    explode={explode}
                    isolate={isolate}
                    rotate={rotate}
                    conceptName="Heart"
                    onViewChange={onViewChange}
                    onToggleRotate={onToggleRotate}
                    onExplodeChange={onExplodeChange}
                    onReset={onReset}
                    onOpenLayers={onOpenLayers}
                    onOpenAbout={onOpenAbout}
                />,
            ),
        );
    }

    function button(label: string): HTMLButtonElement {
        const element = container.querySelector<HTMLButtonElement>(
            `button[aria-label="${label}"]`,
        );
        if (!element) throw new Error(`Missing control: ${label}`);
        return element;
    }

    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        container = document.createElement("div");
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    it.each([
        [0.39, false, false, "SEPARATED STRUCTURES", "Drag to orbit"],
        [0.4, true, false, "SEPARATED STRUCTURES", "Drag to orbit"],
        [0.8, true, false, "SEPARATED STRUCTURES", "Drag to orbit"],
        [0.81, true, true, "SEPARATED STRUCTURES", "Drag to pan"],
        [0.95, true, true, "SEPARATED STRUCTURES", "Drag to pan"],
        [0.96, true, true, "ANATOMICAL INVENTORY", "Drag to pan"],
        [0.05, false, false, "ADULT HUMAN · MALE", "Drag to orbit"],
    ])(
        "retains control thresholds and captions at %s explosion",
        async (explode, rotationDisabled, sideDisabled, caption, hint) => {
            await render(explode);
            expect(button("Rotate body").disabled).toBe(rotationDisabled);
            expect(button("side view").disabled).toBe(sideDisabled);
            expect(button("front view").disabled).toBe(false);
            expect(button("side view").getAttribute("aria-pressed")).toBe(
                "true",
            );
            expect(container.querySelector(".scene-caption")?.textContent).toBe(
                caption,
            );
            expect(
                container.querySelector(".studio-footer")?.textContent,
            ).toContain(hint);
            expect(container.querySelector("output")?.textContent).toBe(
                `${Math.round(explode * 100)}%`,
            );
        },
    );

    it("routes view, rotation, slider, reset and mobile layer actions", async () => {
        await render(0, true, true);
        expect(container.querySelector(".scene-caption")?.textContent).toBe(
            "Heart",
        );
        await act(async () => {
            button("front view").click();
            button("Pause rotation").click();
            button("Reset view and layers").click();
            button("Assemble and reset").click();
            button("Open system layers").click();
        });
        expect(onViewChange).toHaveBeenCalledWith("front");
        expect(onToggleRotate).toHaveBeenCalledTimes(1);
        expect(onReset).toHaveBeenCalledTimes(2);
        expect(onOpenLayers).toHaveBeenCalledTimes(1);
        const slider =
            container.querySelector<HTMLInputElement>("input[type=range]");
        if (!slider) throw new Error("Explosion slider missing");
        expect(slider.getAttribute("aria-labelledby")).toBe("explode-label");
        await act(async () => {
            slider.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "ArrowRight",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(onExplodeChange).toHaveBeenCalledWith(1);
    });
});
