import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, utimesSync, unlinkSync, cpSync } from "fs";
import { join, relative, dirname, parse } from "path";

export type OutputMap = Record<string, Record<string, string>>;
let outputMap: OutputMap = {};

export function buildOutputMap(pagesDir: string, supportedLocales: string[], defaultLocale: string, includeDefaultLocale: boolean, translationMap: Record<string, Record<string, string>>) {
  outputMap = {};

  function walk(dir: string, rel = "") {
    if (!existsSync(dir)) {
      return;
    }

    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const srcRel = rel ? join(rel, ent.name) : ent.name;
      const srcPath = join(dir, ent.name);

      if (ent.isDirectory()) {
        walk(srcPath, srcRel);

      } else {
        outputMap[srcRel] = {};
        
        for (const locale of supportedLocales) {
          if (!includeDefaultLocale && locale === defaultLocale) continue;

          const { name, ext } = parse(ent.name);
          const tName = translationMap[locale]?.[name] ?? name;
    
          const targetRel =
            locale === defaultLocale
              ? join(dirname(srcRel), tName + ext)
              : join(locale, dirname(srcRel), tName + ext);

          outputMap[srcRel][locale] = targetRel;
        }

        if (includeDefaultLocale) {
          const { name, ext } = parse(ent.name);
          const tName = translationMap[defaultLocale]?.[name] ?? name;

          outputMap[srcRel][defaultLocale] = join(defaultLocale, dirname(srcRel), tName + ext);
        }
      }
    }
  }

  walk(pagesDir);
}


export function initTempSrc(srcDir: string, tempSrc: string | undefined, supportedLocales: string[], defaultLocale: string, includeDefaultLocale: boolean,  translationMap: Record<string, Record<string, string>>): string {
  if (!tempSrc) {
    tempSrc = join(srcDir, "..", "src_temp");
  }

  if (existsSync(tempSrc)) {
    rmSync(tempSrc, { recursive: true, force: true });
  }

  cpSync(srcDir, tempSrc, { recursive: true });

  const pagesDir = join(tempSrc, "pages");

  if (!existsSync(pagesDir)) {
    mkdirSync(pagesDir, { recursive: true });
  }

  buildOutputMap(pagesDir, supportedLocales, defaultLocale, includeDefaultLocale, translationMap);

  for (const rel in outputMap) {
    const srcPath = join(pagesDir, rel);
    copyAndRewrite(rel, srcPath, pagesDir, supportedLocales, defaultLocale, includeDefaultLocale, translationMap);
  }

  return tempSrc;
}


function removeTargets(rel: string, pagesBase: string) {
  for (const locale of Object.keys(outputMap[rel] || {})) {
    const target = outputMap[rel]?.[locale] ? join(pagesBase, outputMap[rel][locale]!) : null;

    if (target && existsSync(target)) {
      unlinkSync(target)
    }
  }

  delete outputMap[rel];
}


function copyAndRewrite(rel: string, srcPath: string, pagesBase: string, supportedLocales: string[], defaultLocale: string, includeDefaultLocale: boolean, _translationMap: Record<string, Record<string, string>>) {
  const content = readFileSync(srcPath, "utf-8");
  const newMap: Record<string, string> = {};

  console.log("copy")

  const localesToWrite = includeDefaultLocale
    ? [defaultLocale, ...supportedLocales.filter(l => l !== defaultLocale)]
    : supportedLocales;

  for (const locale of localesToWrite) {
    const targetRel = outputMap[rel]?.[locale];
    
    if (!targetRel) continue;

    const outPath = join(pagesBase, targetRel);
    const outDir = dirname(outPath);
    
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    // Optionally rewrite imports here if needed
    
    writeFileSync(outPath, content, 'utf-8');
    utimesSync(outPath, new Date(), new Date());
    newMap[locale] = targetRel;
  }

  outputMap[rel] = newMap;
}


export function handleFileChange(event: string, filePath: string, srcPagesDir: string, tempSrc: string, supportedLocales: string[], defaultLocale: string, includeDefaultLocale: boolean, translationMap: Record<string, Record<string, string>>) {
  try {
    const rel = relative(srcPagesDir, filePath);

    if (!rel || rel.startsWith("..")) {
      return;
    }

    const pagesBase = join(tempSrc, "pages");

    if (event === "unlink") {
      removeTargets(rel, pagesBase);

    } else if (event === "add" || event === "change") {
      // rebuild map for this file only
      buildOutputMap(pagesBase, supportedLocales, defaultLocale, includeDefaultLocale, translationMap);
      // remove old file(s)
      removeTargets(rel, pagesBase);
      // copy updated file
      copyAndRewrite(rel, filePath, pagesBase, supportedLocales, defaultLocale, includeDefaultLocale, translationMap);
    }

  } catch (err) {
    console.warn(`[astro-i18n] watch handler error: ${err}`);
  }
}


/* export function generateLanguageFolders(pagesDir: string, locales: string[], defaultLocale: string, includeDefault: boolean, translationMap: Record<string, Record<string, string>>) {

  if (!existsSync(pagesDir)) {
    mkdirSync(pagesDir, { recursive: true });
  }

  const entries = readdirSync(pagesDir);

  for (const locale of locales) {
    if (!includeDefault && locale === defaultLocale) continue;

    const locPath = join(pagesDir, locale);
    
    if (!existsSync(locPath)) {
      mkdirSync(locPath, { recursive: true })
    }

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
} */