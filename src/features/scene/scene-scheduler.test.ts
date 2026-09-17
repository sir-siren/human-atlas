import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSceneScheduler } from "./scene-scheduler";

function harness() {
    const requests: FrameRequestCallback[] = [];
    let active = false;
    const frame = vi.fn<(delta: number) => boolean>(() => active);
    const target = new EventTarget();
    const motion = {
        addEventListener:
            vi.fn<(type: string, listener: EventListener) => void>(),
        removeEventListener:
            vi.fn<(type: string, listener: EventListener) => void>(),
        matches: false,
    } as unknown as MediaQueryList;
    const scheduler = createSceneScheduler({
        target,
        document: window.document,
        motion,
        request: (callback) => {
            requests.push(callback);
            return requests.length;
        },
        cancel: (id) => {
            requests.splice(id - 1, 1, () => {});
        },
        frame,
    });
    return {
        scheduler,
        requests,
        frame,
        target,
        motion,
        setActive: (value: boolean) => {
            active = value;
        },
    };
}

function dispatch(target: EventTarget, type: string): void {
    target.dispatchEvent(new Event(type));
}

describe("scene scheduler idle and wake behavior", () => {
    let hidden: (() => boolean) | undefined;
    beforeEach(() => {
        hidden = Object.getOwnPropertyDescriptor(document, "hidden")?.get;
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
        });
    });
    afterEach(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: hidden,
        });
    });

    it("sleeps when settled and wakes on pointer, wheel, state, load and resize invalidations", () => {
        const { scheduler, requests, frame, setActive } = harness();
        expect(requests).toHaveLength(1);
        requests[0]!(100);
        expect(frame).toHaveBeenCalledWith(1 / 60);
        expect(requests).toHaveLength(1);

        setActive(true);
        scheduler.invalidate();
        expect(requests).toHaveLength(2);
        requests[1]!(120);
        expect(requests).toHaveLength(3);

        setActive(false);
        requests[2]!(140);
        expect(requests).toHaveLength(3);
        scheduler.dispose();
    });

    it("coalesces bursts of wake events into a single pending frame", () => {
        const { scheduler, requests } = harness();
        requests[0]!(100);
        const before = requests.length;
        scheduler.invalidate();
        scheduler.invalidate();
        scheduler.invalidate();
        expect(requests.length).toBe(before + 1);
        scheduler.dispose();
    });

    it("does not schedule frames while the page is hidden and resumes on return", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        const { scheduler, requests } = harness();
        expect(requests).toHaveLength(0);
        scheduler.invalidate();
        expect(requests).toHaveLength(0);
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
        });
        dispatch(document, "visibilitychange");
        expect(requests).toHaveLength(1);
        scheduler.dispose();
    });

    it("pauses an in-flight loop when the page hides and resets the clock on resume", () => {
        const { scheduler, requests, frame, setActive } = harness();
        setActive(true);
        requests[0]!(100);
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true,
        });
        dispatch(document, "visibilitychange");
        const pending = requests.length;
        requests[pending - 1]!(120);
        expect(frame).toHaveBeenCalledTimes(1);
        scheduler.invalidate();
        expect(requests.length).toBe(pending);
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false,
        });
        dispatch(document, "visibilitychange");
        requests[requests.length - 1]!(100000);
        expect(frame).toHaveBeenLastCalledWith(1 / 60);
        scheduler.dispose();
    });

    it("wakes on each pointer and wheel event type on the renderer element", () => {
        const { scheduler, requests, target } = harness();
        requests[0]!(100);
        let time = 100;
        for (const type of [
            "pointerdown",
            "pointermove",
            "pointerup",
            "wheel",
        ]) {
            const before = requests.length;
            dispatch(target, type);
            expect(requests.length).toBe(before + 1);
            requests[requests.length - 1]!((time += 16));
        }
        scheduler.dispose();
    });

    it("wakes when the reduced-motion preference changes and detaches its listener on dispose", () => {
        const { scheduler, requests, motion } = harness();
        requests[0]!(100);
        const registered = (motion.addEventListener as ReturnType<typeof vi.fn>)
            .mock.calls[0] as [string, () => void] | undefined;
        expect(registered?.[0]).toBe("change");
        const before = requests.length;
        registered?.[1]();
        expect(requests.length).toBe(before + 1);
        scheduler.dispose();
        expect(motion.removeEventListener).toHaveBeenCalledWith(
            "change",
            registered?.[1],
        );
    });

    it("stops scheduling entirely after disposal", () => {
        const { scheduler, requests } = harness();
        scheduler.dispose();
        const before = requests.length;
        scheduler.invalidate();
        expect(requests.length).toBe(before);
    });
});
