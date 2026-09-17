import { describe, expect, it } from "vitest";
import { PointerTap } from "@/features/pointer-tap";

describe("PointerTap", () => {
    it("registers a simple stationary down and up as a valid tap", () => {
        const tap = new PointerTap();
        tap.down(1, 10, 10, 5);
        expect(tap.up(1, 12, 11)).toBe(true);
    });

    it("rejects drag movement exceeding threshold", () => {
        const tap = new PointerTap();
        tap.down(1, 10, 10, 5);
        tap.move(1, 40, 10);
        expect(tap.up(1, 40, 10)).toBe(false);
    });

    it("rejects multitouch interaction sequences", () => {
        const tap = new PointerTap();
        tap.down(1, 10, 10, 12);
        tap.down(2, 20, 20, 12);
        expect(tap.up(2, 20, 20)).toBe(false);
        expect(tap.up(1, 10, 10)).toBe(false);
    });

    it("rejects sequence when canceled", () => {
        const tap = new PointerTap();
        tap.down(1, 10, 10, 5);
        tap.cancel(1);
        expect(tap.up(1, 10, 10)).toBe(false);
    });
});
