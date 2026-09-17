import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void): () => void {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", callback);
    return (): void => {
        mql.removeEventListener("change", callback);
    };
}

function getSnapshot(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerSnapshot(): boolean {
    return false;
}

/** Report viewports below 768 CSS pixels wide, with false during server rendering/hydration. */
export function useIsMobile(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
