import tailwindcss from "@tailwindcss/vite";
import { createResolver } from "astro-integration-kit";
import { hmrIntegration } from "astro-integration-kit/dev";
import { defineConfig } from "astro/config";

const { default: astroI18nDynamic } = await import("astro-i18n-dynamic");

// https://astro.build/config
export default defineConfig({
	integrations: [
		astroI18nDynamic({
			supportedLocales: ["en", "es", "fr"],
			defaultLocale: "en",
			includeDefaultLocale: false,
			translationMap: {
				es: { home: "inicio", about: "acerca" },
        		fr: { home: "accueil", about: "apropos" }
			}
		}),
		hmrIntegration({
			directory: createResolver(import.meta.url).resolve("../package/dist"),
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
