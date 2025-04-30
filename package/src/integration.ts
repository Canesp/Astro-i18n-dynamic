import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";
import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path";
import { existsSync, mkdirSync, rmSync, cpSync } from "fs";
import { mirrorChange, generateLanguageFolders } from "./utils/fileUtils.ts";


export interface I18nOptions {
	supportedLocales?: string[];
	defaultLocale?: string;
	includeDefaultLocale?: boolean;
	translationMap?: Record<string, Record<string, string>>;
}


export default function i18nIntegration({ supportedLocales = [], defaultLocale = "en", includeDefaultLocale = false, translationMap = {} }: I18nOptions = {}): AstroIntegration {
	let tempSrc: string;

	function viteI18nPlugin(): Plugin {
		return {
			name: "vite:astro-i18n-dynamic",
			configureServer(server) {
				const originalSrc = join(server.config.root, "src");
				tempSrc = join(originalSrc, "..", "src_temp");

				server.watcher.add(originalSrc);
				server.watcher.on("all", (_event, changed) => {
					mirrorChange(originalSrc, tempSrc, supportedLocales, defaultLocale, includeDefaultLocale, translationMap, changed);
				});
			}
		};
	}


	return {
		name: "astro-i18n-dynamic",
		hooks: {
			"astro:config:setup": ({ updateConfig, config, logger}) => {
				logger.info("Setting up i18n integration...");
				const originalSrc = fileURLToPath(config.srcDir);
				tempSrc = join(process.cwd(), "src_temp");

				if (existsSync(tempSrc)) {
					rmSync(tempSrc, { recursive: true, force: true });
				}

				cpSync(originalSrc, tempSrc, { recursive: true });
				mkdirSync(join(tempSrc, "pages"), { recursive: true });	

				generateLanguageFolders(join(tempSrc, "pages"), supportedLocales, defaultLocale, includeDefaultLocale, translationMap);
				
				const tempURL = pathToFileURL(tempSrc + "/");

				logger.info(`tempURL.href = ${tempURL.href}`);
				logger.info(`tempURL.protocol = ${tempURL.protocol}`);

				updateConfig({
					srcDir: new URL(tempURL.href),
					vite: {
						plugins: [viteI18nPlugin()]
					}
				});
			},


			"astro:build:generated": ({ logger }) => {
				logger.info(`Build complete; cleaning up src_temp…`);

				if (existsSync(tempSrc)) {
					rmSync(tempSrc, { recursive: true, force: true });
				}
			},


			"astro:build:done": ({ logger }) => {
				if (existsSync(tempSrc)) {
					rmSync(tempSrc, { recursive: true, force: true });
				}

				logger.info("i18n temp directory removed");
			}
		}
	}
}


// astro-i18n-dynamic