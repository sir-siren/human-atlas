import { ENGINE_SCHEMA } from "./engine-types";
import type {
    EngineRequest,
    EngineResponse,
    EngineStatus,
    GeometryJob,
    PreparedChunk,
} from "./engine-types";
import { prepareFallback } from "./geometry-fallback";

let generationCounter = 0;
const abortError = (): DOMException =>
    new DOMException("Geometry loading was aborted.", "AbortError");

/**
 * Own a single geometry worker and fall back to TypeScript when worker preparation fails.
 * Aborting the constructor signal disposes the client; dispose explicitly on scene teardown.
 */
export class GeometryEngineClient {
    readonly generation = ++generationCounter;
    status: EngineStatus = "loading";
    private worker?: Worker;
    private requestId = 0;
    private pending?: {
        id: number;
        resolve: (result: PreparedChunk) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
    };
    private active = false;
    private readonly controller = new AbortController();
    private readonly abort = (): void => this.dispose();

    constructor(
        private readonly signal: AbortSignal,
        createWorker: () => Worker = () =>
            new Worker(new URL("./engine.worker.ts", import.meta.url), {
                type: "module",
            }),
    ) {
        if (signal.aborted) {
            this.dispose();
            return;
        }
        signal.addEventListener("abort", this.abort, { once: true });
        try {
            this.worker = createWorker();
            this.worker.onmessage = (
                event: MessageEvent<EngineResponse>,
            ): void => {
                const response = event.data;
                const pending = this.pending;
                if (
                    !pending ||
                    response.generation !== this.generation ||
                    response.requestId !== pending.id
                )
                    return;
                if (
                    response.schema !== ENGINE_SCHEMA ||
                    response.operation !== "prepare"
                ) {
                    this.failWorker(
                        new Error("Unsupported anatomy engine protocol."),
                    );
                    return;
                }
                if (response.error || !response.result) {
                    this.failWorker(
                        new Error(
                            response.error ??
                                "An anatomy engine result is missing.",
                        ),
                    );
                    return;
                }
                this.pending = undefined;
                clearTimeout(pending.timer);
                this.status = "ready";
                pending.resolve(response.result);
            };
            this.worker.onerror = (): void =>
                this.failWorker(new Error("An anatomy worker failed."));
            this.worker.onmessageerror = (): void =>
                this.failWorker(new Error("An anatomy worker message failed."));
        } catch {
            this.status = "fallback";
        }
    }

    private failWorker(error: Error): void {
        this.worker?.terminate();
        this.worker = undefined;
        this.status = "fallback";
        const pending = this.pending;
        this.pending = undefined;
        if (pending) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
    }

    /**
     * Fetch and pack one chunk into caller-owned buffers without mutating the job.
     * Worker failure retries the download through the main-thread fallback.
     * @throws When disposed, another job is active, or fallback loading/validation fails.
     */
    async prepare(job: GeometryJob): Promise<PreparedChunk> {
        if (this.status === "disposed") throw abortError();
        if (this.active)
            throw new Error(
                "Only one anatomy preparation job may be in flight.",
            );
        this.active = true;
        try {
            if (this.worker) {
                try {
                    return await new Promise<PreparedChunk>(
                        (resolve, reject) => {
                            const id = ++this.requestId;
                            const timer = setTimeout(
                                () =>
                                    this.failWorker(
                                        new Error(
                                            "An anatomy worker timed out.",
                                        ),
                                    ),
                                120_000,
                            );
                            this.pending = { id, resolve, reject, timer };
                            try {
                                this.worker!.postMessage({
                                    schema: ENGINE_SCHEMA,
                                    generation: this.generation,
                                    requestId: id,
                                    operation: "prepare",
                                    job,
                                } satisfies EngineRequest);
                            } catch (error) {
                                this.failWorker(
                                    error instanceof Error
                                        ? error
                                        : new Error(String(error)),
                                );
                            }
                        },
                    );
                } catch {
                    this.controller.signal.throwIfAborted();
                }
            }
            return await prepareFallback(job, this.controller.signal);
        } finally {
            this.active = false;
        }
    }

    /** Terminate the worker, abort pending loading, and release listeners; repeated calls do nothing. */
    dispose(): void {
        if (this.status === "disposed") return;
        this.controller.abort();
        this.failWorker(abortError());
        this.status = "disposed";
        this.signal.removeEventListener("abort", this.abort);
    }
}
