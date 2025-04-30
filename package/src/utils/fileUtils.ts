import { existsSync, mkdirSync, rmSync, cpSync, readdirSync, readFileSync, writeFileSync, statSync, utimesSync } from "fs";
import { join, relative, parse, sep } from "path";

export function generateLanguageFolders(pagesDir: string, locales: string[], defaultLocale: string, includeDefault: boolean, translationMap: Record<string, Record<string, string>>) {
    const entries = readdirSync(pagesDir);

    for (const locale of locales) {
      if (!includeDefault && locale === defaultLocale) continue;
      const locPath = join(pagesDir, locale);
      if (!existsSync(locPath)) mkdirSync(locPath, { recursive: true });
  
      for (const entry of entries) {
        if (entry === locale) continue;
        const src = join(pagesDir, entry);
        const { name, ext } = parse(entry);
        const tName = translationMap[locale]?.[name] ?? name;
        const dest = join(locPath, tName + ext);
        if (statSync(src).isDirectory()) {
          copyDir(src, dest, locale, translationMap);
        } else {
          copyFile(src, dest);
        }
      }
    }
}


function copyDir(srcDir: string, destDir: string, locale: string, translationMap: Record<string, Record<string, string>>) {
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    for (const e of readdirSync(srcDir)) {
      const src = join(srcDir, e);
      const { name, ext } = parse(e);
      const tName = translationMap[locale]?.[name] ?? name;
      const dest = join(destDir, tName + ext);
      statSync(src).isDirectory()
        ? copyDir(src, dest, locale, translationMap)
        : copyFile(src, dest);
    }
}


function copyFile(src: string, dest: string) {
    const codeExt = ['.astro','.ts','.tsx','.js'];
    if (codeExt.includes(parse(src).ext)) {
      let txt = readFileSync(src, 'utf-8')
        .replace(/import\s+(.*?)\s+from\s+['"](\.{1,2}\/.*)['"]/g, `import $1 from '../$2'`);
      writeFileSync(dest, txt);
      utimesSync(dest, new Date(), new Date());
    } else {
      cpSync(src, dest);
    }
}

export function mirrorChange(original: string, temp: string, locales: string[], defaultLocale: string, includeDefault: boolean, translationMap: Record<string, Record<string, string>>, changed: string) {
    const rel = relative(original, changed);
    const dest = join(temp, rel);
    if (existsSync(changed)) {
      cpSync(changed, dest, { recursive: true });
      if (rel.startsWith(`pages${sep}`)) {
        rmSync(join(temp,'pages'),{ recursive:true, force:true });
        generateLanguageFolders(join(temp,'pages'), locales, defaultLocale, includeDefault, translationMap);
      }
    } else if (existsSync(dest)) {
      rmSync(dest, { recursive:true, force:true });
      if (rel.startsWith(`pages${sep}`)) {
        rmSync(join(temp,'pages'),{ recursive:true, force:true });
        generateLanguageFolders(join(temp,'pages'), locales, defaultLocale, includeDefault, translationMap);
      }
    }
}