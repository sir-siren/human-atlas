import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync } from "oxc-parser";
import { transformSync } from "oxc-transform";
import { ResolverFactory } from "oxc-resolver";
import { minifySync } from "oxc-minify";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");

console.log("--- Strict TypeScript + TSX OXC Toolchain Verification ---");

// 1. Verify oxc-resolver strictly for .tsx, .ts, and .json
const resolver = new ResolverFactory({
    alias: {
        "@": [srcDir],
    },
    extensions: [".tsx", ".ts", ".json"],
});

const resolvedApp = resolver.sync(rootDir, "@/App");
if (!resolvedApp.path || !resolvedApp.path.endsWith(".tsx")) {
    throw new Error("oxc-resolver failed to resolve TSX file @/App");
}
console.log(
    "✓ oxc-resolver: resolved @/App ->",
    path.relative(rootDir, resolvedApp.path),
);

// 2. Verify oxc-parser on all TypeScript and TSX files in src
const filesToVerify: string[] = [];
function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== "dist") {
                walk(full);
            }
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
            filesToVerify.push(full);
        }
    }
}
walk(srcDir);

let totalParsed = 0;
let tsxCount = 0;
let tsCount = 0;

for (const file of filesToVerify) {
    const content = fs.readFileSync(file, "utf8");
    const isTsx = file.endsWith(".tsx");
    if (isTsx) tsxCount++;
    else tsCount++;

    const parseResult = parseSync(file, content, {
        lang: isTsx ? "tsx" : "ts",
        sourceType: "module",
    });

    if (parseResult.errors.length > 0) {
        console.error(`oxc-parser error in ${file}:`, parseResult.errors[0]);
        throw new Error(`oxc-parser failed on ${file}`);
    }
    totalParsed++;
}
console.log(
    `✓ oxc-parser: successfully parsed ${totalParsed} files (${tsxCount} TSX components, ${tsCount} TypeScript modules) with 0 syntax errors.`,
);

// 3. Verify oxc-transform on TSX component (App.tsx)
const appSource = fs.readFileSync(resolvedApp.path, "utf8");
const transformed = transformSync("App.tsx", appSource, {
    lang: "tsx",
    jsx: { runtime: "automatic" },
    typescript: {
        onlyRemoveTypeImports: false,
    },
});

if (transformed.errors.length > 0) {
    throw new Error("oxc-transform failed on TSX compilation");
}
console.log(
    `✓ oxc-transform: successfully compiled TSX App.tsx (${transformed.code.length} bytes output, TSX compiled to runtime).`,
);

// 4. Verify oxc-minify
const minified = minifySync("App.js", transformed.code);
if (minified.errors.length > 0) {
    throw new Error("oxc-minify failed on App.js");
}
console.log(
    `✓ oxc-minify: minified transformed output to ${minified.code.length} bytes (ratio: ${((minified.code.length / transformed.code.length) * 100).toFixed(1)}%).`,
);

console.log(
    "--- All 4 OXC tools verified for strict TSX/TypeScript operation! ---",
);
