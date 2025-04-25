import { defineIntegration } from "astro-integration-kit";
import { promises as fs } from "fs";
import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import { z } from "zod";
import { rewriteImports } from "./utils/importRewrite";
import { generateVirtualPages } from "./utils/virtualPages";


const OptionsSchema = z.object({
	supportedLocales: z.array(z.string()).min(1),
	defaultLocale: z.string(),
	includeDefaultLocale: z.boolean().optional().default(false),
	translationMap: z.record(z.record(z.string())).optional().default({}),
});

type IntegrationOptions = z.infer<typeof OptionsSchema>;


export default function astroI18nDynamic(rawOptions: Partial<IntegrationOptions> = {}) {
	const { supportedLocales, defaultLocale, includeDefaultLocale, translationMap } = OptionsSchema.parse(rawOptions); 

	let watcher: FSWatcher | null = null;

	return defineIntegration({
		name: "astro-i18n-dynamic",
		hooks: {
			"astro:config:setup": async ({ config, logger, addPages }) =>  {
				const pagesDir = path.resolve(config.srcDir.pathname, "pages");
				logger.info(`[astro-i18n-dynamic] Watching pages: ${pagesDir}`);

				// Initial virtual page generation.
				await generateVirtualPages({ config, supportedLocales, defaultLocale, includeDefaultLocale, translationMap, logger }); 

				// Watch for changes in pages/.
				watcher = chokidar.watch(pagesDir, { ignoreInitial: true, ignored: "/(^|[\/\])\../" });
				watcher.on("all", async (event, filePath) => {
					logger.info(`[astro-i18n-dynamic] ${event} at ${filePath}`);
					await generateVirtualPages({ config, supportedLocales, defaultLocale, includeDefaultLocale, translationMap, logger });
				}); 
			},

			"astro:build:done": async ({ logger }) => {
				if (watcher) {
					await watcher.close();
					logger.info("[astro-i18n-dynamic] Watcher closed");
				}
			}
		}
	})
}
