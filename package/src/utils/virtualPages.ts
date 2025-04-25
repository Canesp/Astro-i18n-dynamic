import { addVirtualImport } from "astro-integration-kit";
import { rewriteImports } from "./importRewrite.js";
import path from "path";
import { promises as fs } from "fs";

type PageParams = {
    config: any;
    supportedLocales: string[];
    defaultLocale: string;
    includeDefaultLocale: boolean;
    translationMap: Record<string, Record<string, string>>;
    logger: any;
};

export async function generateVirtualPages(params: PageParams) {
    const { config, supportedLocales, defaultLocale, includeDefaultLocale, translationMap, logger } = params;
    const pagesDir = path.resolve(config.srcDir.pathname, "pages");
    let entries: string[] = [];

    try {
        entries = await fs.readdir(pagesDir);
    } catch {
        logger.warn("[astro-i18n-dynamic] Unable to read pages directory");
        return;
    }

    for (const locale of supportedLocales) {
        if (!includeDefaultLocale && locale == defaultLocale) {
            continue;
        }

        for (const file of entries) {
            const filePath = path.join(pagesDir, file);
            const fileKey = path.parse(file).name;
            const translatedName = translationMap[locale]?.[fileKey] ?? fileKey;
            const virtualPath = `/virtual-i18n/${locale}/${translatedName}.astro`;
            const absolutePath = path.join(pagesDir, file);
            const code = await fs.readFile(absolutePath, "utf-8");

            // rewrite imports.
            const transformed = rewriteImports(code);
            addVirtualImport(virtualPath, `export default ${JSON.stringify(transformed)}`);
            logger.info(`[astro-i18n-dynamic] Virtual page: ${virtualPath}`);
        }
    }
}