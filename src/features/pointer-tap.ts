interface ActivePointer {
    readonly x: number;
    readonly y: number;
    readonly threshold: number;
}

/**
 * Distinguish an intentional single-pointer tap from an orbit, pinch, pan,
 * or canceled touch sequence.
 *
 * Feed pointer IDs and client coordinates from one event sequence. Coordinates and movement
 * thresholds are CSS pixels. Multiple pointers or excess movement block tapping until all
 * tracked pointers end and a new sequence begins. `up` consumes a pointer even when not a tap.
 */
export class PointerTap {
    private readonly active = new Map<number, ActivePointer>();
    private blocked = false;

    public down(id: number, x: number, y: number, threshold: number): void {
        if (this.active.size === 0) {
            this.blocked = false;
        }
        this.active.set(id, { x, y, threshold });
        if (this.active.size > 1) {
            this.blocked = true;
        }
    }

    public move(id: number, x: number, y: number): void {
        const start = this.active.get(id);
        if (start && Math.hypot(x - start.x, y - start.y) > start.threshold) {
            this.blocked = true;
        }
    }

    public up(id: number, x: number, y: number): boolean {
        this.move(id, x, y);
        const isTap =
            this.active.has(id) && this.active.size === 1 && !this.blocked;
        this.active.delete(id);
        return isTap;
    }

    public cancel(id: number): void {
        this.active.delete(id);
        this.blocked = true;
    }
}
