import { describe, expect, it } from "vitest";
import { decodeModelResponse } from "@/features/model-download";

describe("decodeModelResponse", () => {
    it("decodes uncompressed array buffer response", async () => {
        const rawData = new Uint8Array([1, 2, 3, 4, 5]);
        const response = new Response(rawData.buffer, { status: 200 });

        const decoded = await decodeModelResponse(response, 5, false);
        expect(decoded.byteLength).toBe(5);
        expect(new Uint8Array(decoded)).toEqual(rawData);
    });

    it("throws when payload size does not match expected size", async () => {
        const rawData = new Uint8Array([1, 2, 3]);
        const response = new Response(rawData.buffer, { status: 200 });

        await expect(decodeModelResponse(response, 10, false)).rejects.toThrow(
            "An anatomy file was incomplete. Please reload the viewer.",
        );
    });

    it("throws on negative or invalid expected bytes", async () => {
        const response = new Response(new Uint8Array([]).buffer, {
            status: 200,
        });
        await expect(decodeModelResponse(response, -1, false)).rejects.toThrow(
            "An anatomy file has an invalid expected size.",
        );
    });

    it("throws when response status is not ok", async () => {
        const response = new Response(null, { status: 404 });
        await expect(decodeModelResponse(response, 0, false)).rejects.toThrow(
            "An anatomy file could not be loaded.",
        );
    });
});
