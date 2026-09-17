import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const engine = resolve("engine");
const version = spawnSync("wasm-pack", ["--version"], { encoding: "utf8" });
if (version.status !== 0 || version.stdout.trim() !== "wasm-pack 0.15.0") {
    console.error(
        "Install wasm-pack 0.15.0, then run bun run engine:build. Rust is pinned by engine/rust-toolchain.toml.",
    );
    process.exit(1);
}
// Keep build scratch inside the workspace; never configure global Rust state.
mkdirSync(resolve(engine, "target", "scratch"), { recursive: true });
const result = spawnSync(
    "wasm-pack",
    [
        "build",
        "crates/atlas-wasm",
        "--target",
        "web",
        "--out-dir",
        "../../pkg",
        "--out-name",
        "atlas_wasm",
        "--release",
        "--",
        "--locked",
    ],
    {
        cwd: engine,
        stdio: "inherit",
        env: {
            ...process.env,
            CARGO_BUILD_JOBS: "1",
            TMPDIR: resolve(engine, "target", "scratch"),
        },
    },
);
if (result.status !== 0) process.exit(result.status ?? 1);
for (const file of ["atlas_wasm.js", "atlas_wasm.d.ts", "atlas_wasm_bg.wasm"]) {
    if (!existsSync(resolve(engine, "pkg", file)))
        throw new Error(`Missing generated engine artifact: ${file}`);
}
