import { createFrameScheduler } from "./frame-scheduler";

interface SceneSchedulerOptions {
    readonly target: EventTarget;
    readonly document: Document;
    readonly motion: MediaQueryList;
    readonly request: (callback: FrameRequestCallback) => number;
    readonly cancel: (id: number) => void;
    readonly frame: (delta: number) => boolean;
}

/**
 * Wake scene frames on pointer, wheel, visibility, and motion-preference changes.
 *
 * Uses {@link createFrameScheduler}'s seconds-based callback contract. Starts immediately
 * unless the document is hidden; hidden documents cancel pending frames. The caller must
 * dispose the scheduler to remove listeners and cancel work. Does not own the event targets.
 */
export function createSceneScheduler({
    target,
    document,
    motion,
    request,
    cancel,
    frame,
}: SceneSchedulerOptions) {
    const scheduler = createFrameScheduler({ request, cancel, frame });
    const wake = (): void => scheduler.invalidate();
    const onVisibility = (): void => {
        scheduler.setPaused(document.hidden);
        if (!document.hidden) scheduler.invalidate();
    };
    const wakeEvents = [
        "pointerdown",
        "pointermove",
        "pointerup",
        "wheel",
    ] as const;
    for (const event of wakeEvents)
        target.addEventListener(event, wake, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", wake);
    onVisibility();

    return {
        invalidate: wake,
        dispose(): void {
            scheduler.dispose();
            document.removeEventListener("visibilitychange", onVisibility);
            motion.removeEventListener("change", wake);
            for (const event of wakeEvents)
                target.removeEventListener(event, wake);
        },
    };
}
