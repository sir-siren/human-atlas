import { afterEach, describe, expect, it, vi } from "vitest";
import { GeometryEngineClient } from "../engine-client";
import { ENGINE_SCHEMA } from "../engine-types";
import type {
    EngineRequest,
    EngineResponse,
    PreparedChunk,
} from "../engine-types";

class TestWorker {
    onmessage: ((event: MessageEvent<EngineResponse>) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    postMessage = vi.fn<(request: EngineRequest) => void>();
    terminate = vi.fn<() => void>();
    reply(response: EngineResponse): void {
        this.onmessage?.({ data: response } as MessageEvent<EngineResponse>);
    }
}
const job = { url: "chunk", bytes: 0, parts: [] };
const result = (): PreparedChunk => ({
    source: new ArrayBuffer(0),
    batches: [],
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("bounded geometry worker client", () => {
    it("accepts only matching schema/generation/request and rejects concurrent work", async () => {
        const worker = new TestWorker();
        const client = new GeometryEngineClient(
            new AbortController().signal,
            () => worker as unknown as Worker,
        );
        try {
            const pending = client.prepare(job);
            await expect(client.prepare(job)).rejects.toThrow("Only one");
            const request = worker.postMessage.mock.calls[0]![0];
            worker.reply({
                ...request,
                generation: request.generation - 1,
                result: result(),
            });
            worker.reply({
                ...request,
                requestId: request.requestId + 1,
                result: result(),
            });
            expect(client.status).toBe("loading");
            const prepared = result();
            worker.reply({ ...request, result: prepared });
            expect(await pending).toBe(prepared);
            expect(client.status).toBe("ready");
        } finally {
            client.dispose();
        }
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it("terminates failed WASM worker before fetching exactly once in fallback", async () => {
        const worker = new TestWorker();
        const fetch = vi.fn<typeof globalThis.fetch>(() => {
            expect(worker.terminate).toHaveBeenCalledOnce();
            return Promise.resolve(new Response(new ArrayBuffer(0)));
        });
        vi.stubGlobal("fetch", fetch);
        const client = new GeometryEngineClient(
            new AbortController().signal,
            () => worker as unknown as Worker,
        );
        try {
            const pending = client.prepare(job);
            worker.reply({
                ...worker.postMessage.mock.calls[0]![0],
                error: "WASM unavailable",
            });
            expect(await pending).toEqual(result());
            expect(client.status).toBe("fallback");
            expect(fetch).toHaveBeenCalledOnce();
        } finally {
            client.dispose();
        }
    });

    it("aborts disposal, terminates worker and ignores late results without fallback", async () => {
        const worker = new TestWorker();
        const controller = new AbortController();
        const fetch = vi.fn<typeof globalThis.fetch>();
        vi.stubGlobal("fetch", fetch);
        const client = new GeometryEngineClient(
            controller.signal,
            () => worker as unknown as Worker,
        );
        const pending = client.prepare(job);
        controller.abort();
        worker.reply({
            ...worker.postMessage.mock.calls[0]![0],
            result: result(),
        });
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(client.status).toBe("disposed");
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("supports worker construction failure and cancels fallback fetch", async () => {
        const controller = new AbortController();
        let fetchSignal: AbortSignal | undefined;
        vi.stubGlobal(
            "fetch",
            vi.fn((_url, options: RequestInit) => {
                fetchSignal = options.signal as AbortSignal;
                return new Promise((_resolve, reject) =>
                    fetchSignal!.addEventListener("abort", () =>
                        reject(new DOMException("Aborted", "AbortError")),
                    ),
                );
            }),
        );
        const client = new GeometryEngineClient(controller.signal, () => {
            throw new Error("unsupported");
        });
        const pending = client.prepare(job);
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(fetchSignal?.aborted).toBe(true);
    });

    it("times out a hung worker and falls back without an unbounded queue", async () => {
        vi.useFakeTimers();
        const worker = new TestWorker();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(new ArrayBuffer(0))),
        );
        const client = new GeometryEngineClient(
            new AbortController().signal,
            () => worker as unknown as Worker,
        );
        const pending = client.prepare(job);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(await pending).toEqual(result());
        expect(client.status).toBe("fallback");
        client.dispose();
        expect(ENGINE_SCHEMA).toBe(1);
    });
});
