import { expect, it, vi } from "vitest";
import { createFrameScheduler } from "./frame-scheduler";

it("coalesces invalidations, converges to idle, and resets time after hiding", () => {
    let callback: FrameRequestCallback | undefined;
    let active = true;
    const request = vi.fn<(next: FrameRequestCallback) => number>((next) => {
        callback = next;
        return 1;
    });
    const cancel = vi.fn<(id: number) => void>();
    const frame = vi.fn<() => boolean>(() => active);
    const scheduler = createFrameScheduler({ request, cancel, frame });
    scheduler.invalidate();
    scheduler.invalidate();
    expect(request).toHaveBeenCalledTimes(1);
    callback?.(100);
    expect(request).toHaveBeenCalledTimes(2);
    active = false;
    callback?.(120);
    expect(request).toHaveBeenCalledTimes(2);
    scheduler.invalidate();
    scheduler.setPaused(true);
    expect(cancel).toHaveBeenCalledWith(1);
    scheduler.invalidate();
    expect(request).toHaveBeenCalledTimes(3);
    scheduler.setPaused(false);
    callback?.(100000);
    expect(frame).toHaveBeenLastCalledWith(1 / 60);
    scheduler.dispose();
    scheduler.invalidate();
    expect(request).toHaveBeenCalledTimes(4);
});

it("does not perpetuate invalidations raised during rendering", () => {
    let callback: FrameRequestCallback | undefined;
    const request = vi.fn<(next: FrameRequestCallback) => number>((next) => {
        callback = next;
        return 1;
    });
    const scheduler = createFrameScheduler({
        request,
        cancel: vi.fn<(id: number) => void>(),
        frame: () => {
            scheduler.invalidate();
            return false;
        },
    });
    scheduler.invalidate();
    callback?.(10);
    expect(request).toHaveBeenCalledTimes(1);
});
