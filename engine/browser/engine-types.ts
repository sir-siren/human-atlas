export const ENGINE_SCHEMA = 1;
export const MAX_CHUNK_BYTES = 64 * 1024 * 1024;

export interface GeometryPart {
    readonly id: number;
    readonly system: number;
    readonly positions: number;
    readonly normals: number;
    readonly indices: number;
    readonly vertexCount: number;
    readonly indexCount: number;
}

export interface GeometryJob {
    readonly url: string;
    readonly gzip?: string;
    readonly bytes: number;
    readonly parts: readonly GeometryPart[];
}

export interface PackedBatch {
    readonly system: number;
    readonly partIds: readonly number[];
    readonly positions: Float32Array<ArrayBuffer>;
    readonly normals: Int16Array<ArrayBuffer>;
    readonly indices: Uint32Array<ArrayBuffer>;
    readonly partIndices: Float32Array<ArrayBuffer>;
    readonly bounds: Float32Array<ArrayBuffer>;
}

export interface PreparedChunk {
    readonly source: ArrayBuffer;
    readonly batches: readonly PackedBatch[];
}

export interface EngineRequest {
    readonly schema: typeof ENGINE_SCHEMA;
    readonly generation: number;
    readonly requestId: number;
    readonly operation: "prepare";
    readonly job: GeometryJob;
}

export interface EngineResponse {
    readonly schema: typeof ENGINE_SCHEMA;
    readonly generation: number;
    readonly requestId: number;
    readonly operation: "prepare";
    readonly result?: PreparedChunk;
    readonly error?: string;
}

export type EngineStatus = "loading" | "ready" | "fallback" | "disposed";
