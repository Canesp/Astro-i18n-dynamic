import { addVirtualImports } from "astro-integration-kit";
import type { HookParameters } from "astro";
import { promises as fs } from "fs";
import path from "path";
import { rewriteImports } from "./importRewrite.js";


type VirtualParams = HookParameters<"astro:config:setup"> & {
    supportedLocales: string[];
    defaultLocale: string;
    includeDefaultLocale: boolean;
    translationMap: Record<string, Record<string, string>>;
};

export async function generateVirtualPages(params: VirtualParams) {
    const { config, supportedLocales, defaultLocale, includeDefaultLocale, translationMap, logger } = params;
    const pagesDir = path.resolve(config.srcDir.pathname, "pages");

    const entries = await fs.readdir(pagesDir).catch(() => {
        logger.warn("[astro-i18n-dynamic] Unable to read pages directory");
        return [];
    });

    const imports: Record<string, string> = {};

    for (const locale of supportedLocales) {
        if (!includeDefaultLocale && locale == defaultLocale) {
            continue;
        }

        for (const file of entries) {
            const fileKey = path.parse(file).name;
            const translatedName = translationMap[locale]?.[fileKey] ?? fileKey;
            const virtualPath = `/virtual-i18n/${locale}/${translatedName}.astro`;
            const code = await fs.readFile(path.join(pagesDir, file), "utf-8");

            // rewrite imports.
            const transformed = rewriteImports(code);

            imports[virtualPath] = `export default ${JSON.stringify(transformed)}`;
            logger.info(`[astro-i18n-dynamic] Queued virtual page: ${virtualPath}`);
        }
    }

    addVirtualImports(params, { imports, name: "astro-i18n-dynamic" });
}