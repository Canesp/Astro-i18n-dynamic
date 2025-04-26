import { defineIntegration } from "astro-integration-kit";
import chokidar, { FSWatcher } from "chokidar";
import path from "path";
import { z } from "zod";
import { generateVirtualPages } from "./utils/virtualPages.js";


const OptionsSchema = z.object({
	supportedLocales: z.array(z.string()).min(1),
	defaultLocale: z.string(),
	includeDefaultLocale: z.boolean().optional().default(false),
	translationMap: z.record(z.record(z.string())).optional().default({}),
});


export default defineIntegration({
	name: "astro-i18n-dynamic",
	optionsSchema: OptionsSchema,

	setup({ options }) {
		let watcher: FSWatcher | null = null;

		return {
			hooks: {
				"astro:config:setup": async (hookParams) =>  {
					const { supportedLocales, defaultLocale, includeDefaultLocale, translationMap } = options;
					const { config, logger } = hookParams;
	
					const pagesDir = path.resolve(config.srcDir.pathname, "pages");
					logger.info(`[astro-i18n-dynamic] Watching pages: ${pagesDir}`);
	
					// Initial virtual page generation.
					await generateVirtualPages({ ...hookParams, supportedLocales, defaultLocale, includeDefaultLocale, translationMap }); 
	
					// Watch for changes in pages/.
					watcher = chokidar.watch(pagesDir, { ignoreInitial: true, ignored: "/(^|[\/\])\../" });
					watcher.on("all", async (event, filePath) => {
						logger.info(`[astro-i18n-dynamic] ${event} at ${filePath}`);
						await generateVirtualPages({ ...hookParams, supportedLocales, defaultLocale, includeDefaultLocale, translationMap }); 
					});
				},
	
				"astro:build:done": async ({ logger }) => {
					if (watcher) {
						await watcher.close();
						logger.info("[astro-i18n-dynamic] Watcher closed");
					}
				}
			}
		};
	}
})

/* export default function astroI18nDynamic(rawOptions: Partial<IntegrationOptions> = {}) {
	const { supportedLocales, defaultLocale, includeDefaultLocale, translationMap } = OptionsSchema.parse(rawOptions); 

	let watcher: FSWatcher | null = null;

	return defineIntegration({
		name: "astro-i18n-dynamic",
		hooks: {
			"astro:config:setup": async (hookParams: HookParameters<"astro:config:setup">) =>  {
				const { config, logger } = hookParams;

				const pagesDir = path.resolve(config.srcDir.pathname, "pages");
				logger.info(`[astro-i18n-dynamic] Watching pages: ${pagesDir}`);

				// Initial virtual page generation.
				await generateVirtualPages({ ...hookParams, supportedLocales, defaultLocale, includeDefaultLocale, translationMap }); 

				// Watch for changes in pages/.
				watcher = chokidar.watch(pagesDir, { ignoreInitial: true, ignored: "/(^|[\/\])\../" });
				watcher.on("all", async (event, filePath) => {
					logger.info(`[astro-i18n-dynamic] ${event} at ${filePath}`);
					await generateVirtualPages({ ...hookParams, supportedLocales, defaultLocale, includeDefaultLocale, translationMap }); 
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
} */
