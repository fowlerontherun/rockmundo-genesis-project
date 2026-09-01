import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, "public");
const wikiRoot = path.join(publicRoot, "wiki");
const indexPath = path.join(wikiRoot, "index.html");
const wikiJsPath = path.join(wikiRoot, "wiki.js");
const landingPath = path.join(repoRoot, "src", "pages", "Landing.tsx");

const failures = [];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkHtml(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractAttributeValues(source, attribute) {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "gi");
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function extractIds(html) {
  return new Set(extractAttributeValues(html, "id"));
}

function normalisePublicTarget(fromFile, rawTarget) {
  const [pathname] = rawTarget.split(/[?#]/, 1);
  if (!pathname) return null;

  if (pathname === "/") return { kind: "app-route" };

  if (pathname.startsWith("/")) {
    if (!pathname.startsWith("/wiki/") && !pathname.startsWith("/hub-tiles/")) {
      return { kind: "app-route" };
    }
    let target = path.join(publicRoot, pathname.replace(/^\/+/, ""));
    if (pathname.endsWith("/")) target = path.join(target, "index.html");
    return { kind: "file", path: target };
  }

  let target = path.resolve(path.dirname(fromFile), pathname);
  if (pathname.endsWith("/")) target = path.join(target, "index.html");
  return { kind: "file", path: target };
}

function hashPart(rawTarget) {
  const hashIndex = rawTarget.indexOf("#");
  return hashIndex === -1 ? "" : decodeURIComponent(rawTarget.slice(hashIndex + 1));
}

function isExternal(rawTarget) {
  return /^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(rawTarget) || rawTarget.startsWith("//");
}

const wikiJs = await readFile(wikiJsPath, "utf8");
const articleIds = new Set([...wikiJs.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]));
const indexHtml = await readFile(indexPath, "utf8");
const indexStaticIds = extractIds(indexHtml);
const allowedIndexHashes = new Set(["home", ...articleIds, ...indexStaticIds]);

for (const relatedMatch of wikiJs.matchAll(/related:\s*\[([^\]]*)\]/g)) {
  for (const idMatch of relatedMatch[1].matchAll(/"([^"]+)"/g)) {
    if (!articleIds.has(idMatch[1])) {
      failures.push(`wiki.js related article points to missing id: ${idMatch[1]}`);
    }
  }
}

async function validateTarget(fromFile, rawTarget, localIds, relativeName) {
  if (!rawTarget || isExternal(rawTarget)) return;

  if (rawTarget.startsWith("#")) {
    const hash = hashPart(rawTarget);
    const valid = fromFile === indexPath ? allowedIndexHashes.has(hash) : localIds?.has(hash);
    if (!valid) failures.push(`${relativeName}: missing local anchor ${rawTarget}`);
    return;
  }

  const target = normalisePublicTarget(fromFile, rawTarget);
  if (!target || target.kind === "app-route") return;

  if (!target.path.startsWith(publicRoot)) {
    failures.push(`${relativeName}: target escapes public directory: ${rawTarget}`);
    return;
  }

  if (!(await exists(target.path))) {
    failures.push(`${relativeName}: missing target ${rawTarget} -> ${path.relative(repoRoot, target.path)}`);
    return;
  }

  const hash = hashPart(rawTarget);
  if (!hash) return;

  if (path.resolve(target.path) === path.resolve(indexPath)) {
    if (!allowedIndexHashes.has(hash)) {
      failures.push(`${relativeName}: missing Compendium article/anchor #${hash}`);
    }
  } else if (target.path.endsWith(".html")) {
    const targetHtml = await readFile(target.path, "utf8");
    if (!extractIds(targetHtml).has(hash)) {
      failures.push(`${relativeName}: ${rawTarget} points to a missing anchor`);
    }
  }
}

const htmlFiles = await walkHtml(wikiRoot);
for (const filePath of htmlFiles) {
  const html = await readFile(filePath, "utf8");
  const localIds = extractIds(html);
  const relativeName = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");

  for (const rawTarget of [...extractAttributeValues(html, "href"), ...extractAttributeValues(html, "src")]) {
    await validateTarget(filePath, rawTarget, localIds, relativeName);
  }
}

const landingSource = await readFile(landingPath, "utf8");
const landingWikiLinks = extractAttributeValues(landingSource, "href").filter((href) => href.startsWith("/wiki/"));
if (!landingWikiLinks.length) {
  failures.push("src/pages/Landing.tsx: no public Compendium links found");
}
for (const rawTarget of landingWikiLinks) {
  await validateTarget(landingPath, rawTarget, null, "src/pages/Landing.tsx");
}

if (!htmlFiles.length) failures.push("No Compendium HTML files were found.");
if (!articleIds.size) failures.push("No Compendium article ids were found in wiki.js.");

if (failures.length) {
  console.error(`Compendium link validation failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `Compendium link validation passed: ${htmlFiles.length} HTML files, ${articleIds.size} reference articles and ${landingWikiLinks.length} public home-page links checked.`,
);
