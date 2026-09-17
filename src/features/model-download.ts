/**
 * Consume a model response and return decoded bytes matching the expected byte length.
 *
 * Fetch may already decode Content-Encoding, so a gzip URL alone does not trigger decoding.
 * @param expectedBytes - Nonnegative safe integer giving the uncompressed size in bytes.
 * @param compressed - Allow gzip decoding when the payload still has gzip magic bytes.
 * @throws Rejects for invalid expected size, non-OK status, unsupported gzip decompression,
 * response read/decompression failures, or a decoded size mismatch.
 */
export async function decodeModelResponse(
    response: Response,
    expectedBytes: number,
    compressed: boolean,
): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
        throw new Error("An anatomy file has an invalid expected size.");
    }

    if (!response.ok) {
        throw new Error("An anatomy file could not be loaded.");
    }

    const payload = await response.arrayBuffer();
    const signature = new Uint8Array(
        payload,
        0,
        Math.min(2, payload.byteLength),
    );
    const isGzip =
        compressed &&
        payload.byteLength >= 2 &&
        signature[0] === 0x1f &&
        signature[1] === 0x8b;

    if (isGzip && typeof DecompressionStream === "undefined") {
        throw new Error("This browser cannot decompress the anatomy file.");
    }

    let buffer: ArrayBuffer;
    if (isGzip) {
        const stream = new Blob([payload])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
        buffer = await new Response(stream).arrayBuffer();
    } else {
        buffer = payload;
    }

    if (buffer.byteLength !== expectedBytes) {
        throw new Error(
            "An anatomy file was incomplete. Please reload the viewer.",
        );
    }

    return buffer;
}
