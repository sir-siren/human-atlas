interface FrameSchedulerOptions {
    readonly request: (callback: FrameRequestCallback) => number;
    readonly cancel: (id: number) => void;
    readonly frame: (delta: number) => boolean;
}

/**
 * Coalesce invalidations into one pending animation frame until disposed.
 *
 * Supply request/cancel functions with requestAnimationFrame semantics (timestamps in ms).
 * `frame` receives seconds, capped at 0.05, with 1/60 for the first frame after idle or pause.
 * Return true from `frame` to continue; invalidations inside it do not schedule another frame.
 * Pausing cancels pending work; resuming schedules a frame. Call `invalidate` to start.
 * Exceptions from callbacks propagate to the caller or animation-frame host; failed frames
 * do not schedule a retry.
 */
export function createFrameScheduler({
    request,
    cancel,
    frame,
}: FrameSchedulerOptions) {
    let pending: number | undefined;
    let previous: number | undefined;
    let paused = false;
    let disposed = false;
    let running = false;
    const invalidate = (): void => {
        if (!paused && !disposed && !running && pending === undefined)
            pending = request(tick);
    };
    const tick: FrameRequestCallback = (time) => {
        pending = undefined;
        if (paused || disposed) return;
        const delta =
            previous === undefined
                ? 1 / 60
                : Math.min((time - previous) / 1000, 0.05);
        previous = time;
        running = true;
        let active = false;
        try {
            active = frame(delta);
        } finally {
            running = false;
        }
        if (active) invalidate();
        else previous = undefined;
    };
    const stop = (): void => {
        if (pending !== undefined) cancel(pending);
        pending = undefined;
        previous = undefined;
    };
    return {
        invalidate,
        setPaused(value: boolean): void {
            paused = value;
            if (value) stop();
            else invalidate();
        },
        dispose(): void {
            disposed = true;
            stop();
        },
    };
}
