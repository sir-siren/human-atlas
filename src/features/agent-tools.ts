import type { Atlas, Concept } from "./anatomy";

export interface ToolAnnotation {
    readonly readOnlyHint: boolean;
}

export interface AtlasTool {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: object;
    readonly annotations: ToolAnnotation;
    readonly execute: (input: unknown) => unknown;
}

function parseRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("Expected an object input for tool execution.");
    }
    return input as Record<string, unknown>;
}

/**
 * Create catalogue search and UI inspection tools without registering them.
 *
 * Tool execution borrows the atlas; inspection invokes `inspect` with its matching concept.
 * Search returns at most 30 matches in catalogue order, unlike the ranked UI search.
 * Executions throw for non-object inputs, missing/invalid query or ID, or an unknown ID;
 * exceptions from `inspect` propagate to the tool caller.
 */
export function atlasTools(
    atlas: Atlas,
    inspect: (concept: Concept) => void,
): readonly AtlasTool[] {
    return [
        {
            name: "find_anatomy",
            description:
                "Find anatomical structures by name or source atlas identifier in this atlas.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", minLength: 1 },
                },
                required: ["query"],
                additionalProperties: false,
            },
            annotations: {
                readOnlyHint: true,
            },
            execute(input: unknown): unknown {
                const data = parseRecord(input);
                const rawQuery = data["query"];
                if (typeof rawQuery !== "string" || !rawQuery.trim()) {
                    throw new Error("A nonempty query is required.");
                }
                const query = rawQuery.toLowerCase().trim();
                return atlas.concepts
                    .filter(
                        (c) =>
                            c.name.toLowerCase().includes(query) ||
                            c.id.toLowerCase().includes(query),
                    )
                    .slice(0, 30)
                    .map((c) => ({
                        id: c.id,
                        name: c.name,
                        pieces: c.elements.length,
                    }));
            },
        },
        {
            name: "inspect_anatomical_structure",
            description:
                "Select an atlas concept in the 3D anatomy and open its visible detail panel.",
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
                additionalProperties: false,
            },
            annotations: {
                readOnlyHint: false,
            },
            execute(input: unknown): unknown {
                const data = parseRecord(input);
                const id = data["id"];
                if (typeof id !== "string" || !id) {
                    throw new Error("An atlas identifier is required.");
                }
                const concept = atlas.concepts.find((c) => c.id === id);
                if (!concept) {
                    throw new Error(
                        "That structure is not present in this atlas.",
                    );
                }
                inspect(concept);
                return {
                    id: concept.id,
                    name: concept.name,
                    selectedPieces: concept.elements.length,
                };
            },
        },
    ] as const;
}

interface ModelContextDocument extends Document {
    readonly modelContext?: {
        readonly registerTool: (
            tool: AtlasTool,
            options: { readonly signal: AbortSignal },
        ) => void | Promise<void>;
    };
}

/**
 * Register atlas tools when the browser exposes the optional modelContext API.
 *
 * Returns undefined when unavailable; otherwise call the returned abort function on cleanup.
 * Registration failures are ignored so the explorer does not depend on this browser capability.
 */
export function registerAtlasTools(
    atlas: Atlas,
    inspect: (concept: Concept) => void,
): (() => void) | undefined {
    if (typeof document === "undefined") {
        return undefined;
    }

    const doc = document as ModelContextDocument;
    const context = doc.modelContext;
    if (typeof context?.registerTool !== "function") {
        return undefined;
    }

    const lifecycle = new AbortController();
    const tools = atlasTools(atlas, inspect);

    for (const tool of tools) {
        try {
            void Promise.resolve(
                context.registerTool(tool, { signal: lifecycle.signal }),
            ).catch(() => {
                // Tool registration is optional; a rejection must not disable the explorer.
            });
        } catch {
            // Some implementations throw synchronously rather than returning a rejected promise.
        }
    }

    return (): void => {
        lifecycle.abort();
    };
}
