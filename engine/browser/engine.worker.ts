import { ENGINE_SCHEMA } from "./engine-types";
import type { EngineRequest, EngineResponse } from "./engine-types";
import { fetchGeometry } from "./geometry-input";
import { initializeWasm, prepareWasm } from "./wasm-loader";

let busy = false;
self.onmessage = async (event: MessageEvent<EngineRequest>): Promise<void> => {
    const request = event.data;
    if (
        request.schema !== ENGINE_SCHEMA ||
        request.operation !== "prepare" ||
        busy
    )
        return;
    busy = true;
    const identity = {
        schema: ENGINE_SCHEMA,
        generation: request.generation,
        requestId: request.requestId,
        operation: "prepare",
    } as const;
    try {
        await initializeWasm();
        const source = await fetchGeometry(
            request.job,
            new AbortController().signal,
        );
        const result = prepareWasm(source, request.job);
        const transfer = [
            source,
            ...result.batches.flatMap((batch) => [
                batch.positions.buffer,
                batch.normals.buffer,
                batch.indices.buffer,
                batch.partIndices.buffer,
                batch.bounds.buffer,
            ]),
        ];
        self.postMessage({ ...identity, result } satisfies EngineResponse, {
            transfer,
        });
    } catch (error) {
        self.postMessage({
            ...identity,
            error: error instanceof Error ? error.message : String(error),
        } satisfies EngineResponse);
    } finally {
        busy = false;
    }
};
