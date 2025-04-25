import { transformSync } from "@babel/core";

export function rewriteImports(code: string): string {
    const result = transformSync(code, {
        plugins: [
            ["babel-plugin-transform-rewrite-imports", { rewrite: (source: string) => { if (source.startsWith(".")) { return `../${source}`; } return source; } }]
        ],
        ast: false,
        code: true
    });

    return result?.code ?? code;
}