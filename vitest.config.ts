import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (relative: string): string =>
    fileURLToPath(new URL(relative, import.meta.url));

const browserTests = [
    "tests/**/*.test.tsx",
    "src/**/*.test.tsx",
    "src/features/scene/render-quality.test.ts",
    "src/features/scene/scene-animation.test.ts",
    "src/features/scene/scene-scheduler.test.ts",
    "src/features/scene/screen-targets.test.ts",
];

export default defineConfig({
    test: {
        globals: false,
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,
        passWithNoTests: false,
        // Bound concurrent test processes on the 4 GB development machine.
        maxWorkers: 1,
        projects: [
            {
                extends: true,
                test: {
                    name: "unit",
                    environment: "node",
                    include: [
                        "tests/**/*.test.ts",
                        "src/**/*.test.ts",
                        "engine/browser/**/*.test.ts",
                    ],
                    exclude: browserTests,
                },
            },
            {
                extends: true,
                test: {
                    name: "dom",
                    environment: "happy-dom",
                    include: browserTests,
                },
            },
        ],
    },
    resolve: {
        alias: {
            "@": resolvePath("./src"),
        },
    },
});
