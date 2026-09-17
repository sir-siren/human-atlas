import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/postcss";
import { parseSync } from "oxc-parser";
import { transformSync } from "oxc-transform";
import { ResolverFactory } from "oxc-resolver";
import { minifySync } from "oxc-minify";

const resolvePath = (relative: string): string =>
    fileURLToPath(new URL(relative, import.meta.url));

/**
 * High-performance Vite plugin leveraging the Rust-based OXC toolchain:
 * - oxc-resolver for sub-millisecond alias & module resolution
 * - oxc-parser for strict AST syntax validation
 * - oxc-transform for instant TS/TSX to JavaScript compilation
 * - oxc-minify for advanced code minification and dead code elimination
 */
function oxcPlugin(): Plugin {
    const resolver = new ResolverFactory({
        alias: {
            "@": [resolvePath("./src")],
        },
        extensions: [".tsx", ".ts", ".json"],
    });

    return {
        name: "vite-plugin-oxc-engine",
        enforce: "pre",
        resolveId(source: string, importer?: string): string | null {
            if (source.startsWith("@/")) {
                const directory = importer
                    ? path.dirname(importer)
                    : resolvePath("./");
                const resolved = resolver.sync(directory, source);
                if (resolved.path) {
                    return resolved.path;
                }
            }
            return null;
        },
        transform(code: string, id: string) {
            const cleanId = id.split("?")[0];
            if (!cleanId || cleanId.includes("node_modules")) {
                return null;
            }

            const ext = cleanId.split(".").pop();
            if (!ext || !["ts", "tsx"].includes(ext)) {
                return null;
            }

            const lang = ext === "tsx" ? "tsx" : "ts";

            // 1. oxc-parser: strict TypeScript / TSX AST parsing and validation
            const parseResult = parseSync(cleanId, code, {
                lang,
                sourceType: "module",
            });
            if (parseResult.errors.length > 0) {
                const error = parseResult.errors[0];
                this.error(
                    `[oxc-parser] ${error?.message ?? "Syntax error"} at ${cleanId}`,
                );
            }

            // 2. oxc-transform: ultra-fast TSX/TS compilation with TypeScript type stripping
            const transformed = transformSync(cleanId, code, {
                lang,
                jsx: { runtime: "automatic" },
                typescript: {
                    onlyRemoveTypeImports: false,
                },
            });

            if (transformed.errors.length > 0) {
                this.error(
                    `[oxc-transform] ${transformed.errors[0]?.message ?? "Transform error"}`,
                );
            }

            return {
                code: transformed.code,
                map: transformed.map ?? null,
            };
        },
        renderChunk(code: string, chunk) {
            if (chunk.fileName.endsWith(".js")) {
                const minified = minifySync(chunk.fileName, code);
                return {
                    code: minified.code,
                };
            }
            return null;
        },
    };
}

export default defineConfig({
    root: resolvePath("./"),
    publicDir: resolvePath("./public"),
    plugins: [oxcPlugin()],
    resolve: {
        alias: {
            "@": resolvePath("./src"),
        },
    },
    css: {
        postcss: {
            plugins: [tailwindcss()],
        },
    },
    server: {
        watch: {
            usePolling: process.env.VITE_USE_POLLING === "1",
        },
    },
    build: {
        outDir: resolvePath("./dist"),
        emptyOutDir: true,
        chunkSizeWarningLimit: 1200,
        rolldownOptions: {
            onLog(level, log, defaultHandler) {
                if (
                    log.code === "MODULE_LEVEL_DIRECTIVE" ||
                    log.message?.includes("MODULE_LEVEL_DIRECTIVE") ||
                    log.message?.includes('directive "use client"')
                ) {
                    return;
                }
                defaultHandler(level, log);
            },
            onwarn(warning, defaultHandler) {
                if (
                    warning.code === "MODULE_LEVEL_DIRECTIVE" ||
                    warning.message?.includes("MODULE_LEVEL_DIRECTIVE") ||
                    warning.message?.includes('directive "use client"')
                ) {
                    return;
                }
                defaultHandler(warning);
            },
            output: {
                codeSplitting: true,
                manualChunks(id: string) {
                    if (id.includes("node_modules/three")) {
                        return "three-engine";
                    }
                    if (
                        id.includes("node_modules/@base-ui") ||
                        id.includes("node_modules/lucide-react")
                    ) {
                        return "ui-vendor";
                    }
                    return undefined;
                },
            },
        },
    },
});
