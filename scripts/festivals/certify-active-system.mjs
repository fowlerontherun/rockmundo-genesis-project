#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const walk = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/")) : [];
const app = read("src/App.tsx");
const sourceRoots = ["src/pages", "src/components", "src/hooks", "src/features/festivals", "src/features/festival-company", "src/services", "src/lib", "src/utils", "src/config"];
const tsFiles = sourceRoots.flatMap(walk).filter(file => /\.(ts|tsx)$/.test(file));
const sqlFiles = [...walk("supabase/migrations"), ...walk("supabase/tests")].filter(file => file.endsWith(".sql"));
const allFiles = [...tsFiles, ...sqlFiles, ...walk("supabase/functions"), ...walk("scripts/festivals")];
const contents = new Map(allFiles.map(file => [file, read(file)]));
const festivalFiles = tsFiles.filter(file => /festival/i.test(file) || /festival/i.test(contents.get(file)));

const semantics = param => ({ festivalCompanyId: "festival_company_id", companyId: "festival_company_id", editionId: "annual_edition_id", festivalSlug: "festival_slug", participationId: "participation_id", sessionId: "performance_session_id", launchId: "launch_id", resultId: "legacy_festival_id", festivalId: "legacy_festival_id" })[param] || "unknown";
const routeRows = [...app.matchAll(/<Route\s+path="([^"]*festival[^"]*)"\s+element=\{([^\n]+)\}/gi)].map((match, index) => {
  const route = `/${match[1].replace(/^\//, "")}`;
  const component = match[2].match(/<([A-Z][A-Za-z0-9]*)/)?.[1] || "unknown";
  const params = [...route.matchAll(/:([A-Za-z0-9_]+)/g)].map(item => ({ parameter: item[1], meaning: semantics(item[1]) }));
  const duplicate = [...app.matchAll(new RegExp(`<Route\\s+path="${match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"))].length > 1;
  const legacy = /Legacy|FestivalDetail|FestivalBrowser|FestivalMarketplace|FestivalDirectory|FestivalPerformance|FestivalOwnerConsole|FestivalRunWizard|FestivalBookingCalendar/.test(match[2]);
  return { route, component, intendedActor: route.startsWith("/admin") ? "administrator" : /manage|run/.test(route) ? "festival owner" : "player/public", identifierSemantics: params, dataSource: legacy ? "legacy festivals/event tables or compatibility services" : "festival-company repositories/RPCs", writeApis: /manage|run|perform/.test(route) ? ["see frontendWrites"] : [], featureFlag: /LegacyFestivalGate/.test(match[2]) ? "legacyFestivalRoutesEnabled" : null, navigationEntryPoints: [], emptyState: "component-owned", errorState: params.length ? "must return a typed domain error" : "component-owned", canonicalReplacement: legacy ? "/world/festivals or /companies/festivals/:festivalCompanyId/setup" : null, disposition: duplicate ? "replace" : legacy ? "redirect_temporarily" : "keep", sourceOrder: index + 1, duplicate };
});

const importersOf = target => tsFiles.filter(file => contents.get(file)?.includes(target.replace(/^.*\//, "").replace(/\.(tsx?|jsx?)$/, "")) && file !== target);
const frontend = festivalFiles.map(file => {
  const text = contents.get(file);
  const writes = [...text.matchAll(/\.from\(["'`]([^"'`]*festival[^"'`]*)["'`]\)\s*\.\s*(insert|update|upsert|delete)|\.rpc\(["'`]([^"'`]*festival[^"'`]*)/gi)]
    .map(m => ({ target: m[1] || m[3], operation: m[2] || "rpc" }));
  const importers = importersOf(file);
  return { file, kind: file.includes("/__tests__/") || /\.test\./.test(file) ? "test" : file.includes("/pages/") ? "page" : file.includes("/hooks/") ? "hook" : "module", importers, status: importers.some(f => !/test/.test(f)) || file === "src/App.tsx" ? (file.includes("festival-company") ? "canonical_active" : "legacy_active_or_cross_domain") : importers.length ? "test_only" : "unused_or_dynamic", directDatabaseWriter: writes.some(w => w.operation !== "rpc"), browserAuthoritativeCalculation: /Math\.random|calculate.*(?:fame|fans|money|reputation|outcome)/i.test(text), writes };
});

const rpcNames = new Set();
for (const text of contents.values()) {
  for (const m of text.matchAll(/(?:create(?:\s+or\s+replace)?\s+function|\.rpc\()\s*["'`]?((?:public\.)?[a-z0-9_]*festival[a-z0-9_]*)/gi)) rpcNames.add(m[1].replace("public.", ""));
}
const rpcs = [...rpcNames].sort().map(name => {
  const callers = allFiles.filter(file => new RegExp(`\\b${name}\\b`, "i").test(contents.get(file)));
  const runtime = callers.filter(file => !file.includes("migrations/") && !file.includes("docs/") && !file.includes("tests/") && file !== "scripts/festivals/certify-active-system.mjs");
  const legacy = /legacy|city_festival|game_event/.test(name);
  return { name, typescriptCallers: callers.filter(f => /\.tsx?$/.test(f)), sqlCallers: callers.filter(f => f.includes("migrations/")), workerCallers: callers.filter(f => f.includes("functions/") || f.includes("scripts/")), testCallers: callers.filter(f => f.includes("tests/") || /\.test\./.test(f)), classification: runtime.length ? (legacy ? "active_legacy" : "active_canonical") : callers.some(f => f.includes("tests/")) ? "test_only" : "no_known_runtime_callers", dynamicCallerReviewRequired: true };
});

const dbObjects = [];
for (const file of sqlFiles.filter(f => f.includes("migrations/"))) {
  const text = contents.get(file);
  for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?(table|view|materialized\s+view|function|trigger|policy|index)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["']?([a-z0-9_]*(?:festival|game_events|city_festivals)[a-z0-9_]*)/gi))
    dbObjects.push({ type: m[1].toLowerCase(), name: m[2], migration: file, ownerDomain: /festival_compan|festival_edition/.test(m[2]) ? "festival-company" : "legacy_or_compatibility", acceptsWrites: /table|function|trigger/.test(m[1]), publiclyExecutable: m[1].toLowerCase() === "function" ? "inspect grants" : false, rls: m[1].toLowerCase() === "table" ? "inspect policies" : "not_applicable", harnessCovered: sqlFiles.filter(f => f.includes("tests/") && contents.get(f).includes(m[2])), replacement: null, retirementStatus: "investigate" });
}

const writes = frontend.flatMap(item => item.writes.map(write => ({ file: item.file, ...write, classification: write.operation === "rpc" ? (/legacy|game_event|city_festival/.test(write.target) ? "legacy_rpc" : "canonical_rpc") : "direct_write_requires_replacement" })));
const duplicateAuthorities = [{ concept: "public festival directory", paths: routeRows.filter(r => r.route === "/world/festivals").map(r => r.component), delegated: false, severity: "broken_unreachable_canonical_route" }, { concept: "festival creation", paths: ["legacy/admin pages", "festival-company founding RPC"], delegated: false, severity: "investigate_active_flags" }];
const retirement = frontend.filter(f => /unused|legacy/.test(f.status)).map(f => ({ candidate: f.file, currentCallers: f.importers, replacement: f.status.startsWith("legacy") ? "festival-company domain" : null, dataMigrationRequirement: "none for source file; preserve data tables", safeRemovalPrerequisite: "route/import/dynamic-reference smoke proof", recommendedRetirementPr: "festival-route-migration", risk: f.directDatabaseWriter ? "high" : "medium", verification: "npm run test:festivals:active-callers", category: f.status.startsWith("unused") ? "investigate" : "remove_after_route_migration" }));
const inventory = { schemaVersion: 1, generatedBy: "scripts/festivals/certify-active-system.mjs", routes: routeRows, frontend, frontendWrites: writes, databaseObjects: dbObjects, rpcs, duplicateAuthorities, retirement };
const output = `${JSON.stringify(inventory, null, 2)}\n`;
const destination = path.join(root, "docs/festivals/festival-active-callers.json");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8") !== output) { console.error("Festival inventory is stale. Run: node scripts/festivals/certify-active-system.mjs"); process.exit(1); }
  if (writes.some(w => w.classification === "direct_write_requires_replacement")) console.warn("Known unsafe direct Festival writes remain quarantined in the reviewed inventory.");
  console.log(`Certified ${routeRows.length} routes, ${frontend.length} frontend files, ${rpcs.length} RPCs and ${dbObjects.length} database objects.`);
} else {
  fs.writeFileSync(destination, output);
  console.log(`Wrote ${path.relative(root, destination)}`);
}
