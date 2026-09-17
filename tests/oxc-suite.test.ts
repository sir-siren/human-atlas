import { describe, expect, it } from "vitest";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { transformSync } from "oxc-transform";
import { ResolverFactory } from "oxc-resolver";
import { minifySync } from "oxc-minify";

describe("OXC Toolchain Integration (Strict TSX & TypeScript)", () => {
    it("resolves project aliases strictly for TSX and TypeScript modules", () => {
        const resolver = new ResolverFactory({
            alias: {
                "@": [path.resolve(process.cwd(), "src")],
            },
            extensions: [".tsx", ".ts", ".json"],
        });

        const resolved = resolver.sync(process.cwd(), "@/App");
        expect(resolved.path).toBeDefined();
        expect(resolved.path?.endsWith("App.tsx")).toBe(true);
    });

    it("parses TypeScript AST using oxc-parser", () => {
        const tsCode =
            "export const add = (a: number, b: number): number => a + b;";
        const parsed = parseSync("test.ts", tsCode, {
            lang: "ts",
            sourceType: "module",
        });

        expect(parsed.errors).toHaveLength(0);
        expect(parsed.program).toBeDefined();
    });

    it("transforms TSX to JavaScript with strict TypeScript type stripping", () => {
        const tsxCode = `
      interface CardProps {
        readonly title: string;
        readonly count: number;
      }
      export const Card = ({ title, count }: CardProps): ReactNode => (
        <div className="card">
          <h2>{title}</h2>
          <span>{count}</span>
        </div>
      );
    `;
        const transformed = transformSync("Card.tsx", tsxCode, {
            lang: "tsx",
            jsx: { runtime: "automatic" },
            typescript: {
                onlyRemoveTypeImports: false,
            },
        });

        expect(transformed.errors).toHaveLength(0);
        expect(transformed.code).toContain("jsx");
        expect(transformed.code).not.toContain("CardProps");
        expect(transformed.code).not.toContain(": ReactNode");
    });

    it("minifies output using oxc-minify", () => {
        const unminified = `
      function calculateSum(firstValue, secondValue) {
        const offset = 10;
        return firstValue + secondValue + offset;
      }
      export { calculateSum };
    `;

        const minified = minifySync("test.js", unminified);
        expect(minified.errors).toHaveLength(0);
        expect(minified.code.length).toBeLessThan(unminified.length);
        expect(minified.code).toContain("calculateSum");
    });
});
