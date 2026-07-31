#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findUndefinedFestivalRouteComponents } from "./route-component-certification.mjs";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const walk = dir => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile()).map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/")) : [];
const app = read("src/App.tsx");
const undefinedFestivalRouteComponents = findUndefinedFestivalRouteComponents(app);
if (undefinedFestivalRouteComponents.length) {
  throw new Error(`Undefined Festival route component(s): ${undefinedFestivalRouteComponents.join(", ")}`);
}
const routeRegistrySource = read("src/features/festivals/routes.ts");
const festivalPatterns = Object.fromEntries([...routeRegistrySource.matchAll(/^\s{2}(\w+): "([^"]+)",$/gm)].map(m => [m[1], m[2]]));
const sourceRoots = ["src/pages", "src/components", "src/hooks", "src/features/festivals", "src/features/festival-company", "src/services", "src/lib", "src/utils", "src/config"];
const tsFiles = sourceRoots.flatMap(walk).filter(file => /\.(ts|tsx)$/.test(file));
const sqlFiles = [...walk("supabase/migrations"), ...walk("supabase/tests")].filter(file => file.endsWith(".sql"));
const allFiles = [...tsFiles, ...sqlFiles, ...walk("supabase/functions"), ...walk("scripts/festivals")];
const contents = new Map(allFiles.map(file => [file, read(file)]));
const festivalFiles = tsFiles.filter(file => /festival/i.test(file) || /festival/i.test(contents.get(file)));
const finalSettlementMigration = read("supabase/migrations/20291218243900_complete_festival_settlement_finalisation.sql");
const effectLifecycleMigration = read("supabase/migrations/20291218244000_festival_settlement_effect_lifecycle.sql");
const canonicalEffectMigration = read("supabase/migrations/20291218244300_canonical_festival_effect_authorities.sql");
const dispatcher = read("supabase/functions/process-festival-settlement-effects/dispatcher.ts");
if (!/ALTER COLUMN applied_at DROP DEFAULT/i.test(effectLifecycleMigration) || !/status NOT IN\('applied','not_applicable'\)/i.test(effectLifecycleMigration)) {
  throw new Error("Festival effects may be recorded as applied before canonical completion.");
}
if (/SET requested_payload=result,status='applied'/i.test(effectLifecycleMigration)) throw new Error("Requested Festival effects are treated as applied results.");
if (!/FESTIVAL_EFFECT_RECOVERY_REQUIRED/.test(effectLifecycleMigration) || !/lease_expires_at/.test(effectLifecycleMigration)) throw new Error("Festival effect recovery lifecycle is incomplete.");
const dispatcherAuthorities = [...dispatcher.matchAll(/:\s*"(apply_festival_[a-z_]+_effect)"/g)].map(match => match[1]);
for (const authority of dispatcherAuthorities) if (!new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${authority}\\s*\\(`, "i").test(canonicalEffectMigration)) throw new Error(`Festival dispatcher authority is undefined: ${authority}`);
const builder = canonicalEffectMigration.match(/CREATE OR REPLACE FUNCTION public\._festival_apply_outcomes[\s\S]*?(?=CREATE OR REPLACE FUNCTION public\.apply_festival_edition_outcomes)/i)?.[0] ?? "";
if (/applied_at[^;]*now\(\)/i.test(builder) || /SET\s+applied_at/i.test(builder)) throw new Error("Festival outcome calculation marks outcomes applied.");
if (/effect_type[^;]*(?:'audience'|'artist'|'sponsor')/i.test(builder)) throw new Error("Festival outcome calculation creates unsupported generic effect types.");
if ((builder.match(/\b70\b/g) ?? []).length > 2) throw new Error("Festival outcome calculation uses hard-coded neutral scores.");
const finaliser = canonicalEffectMigration.match(/CREATE OR REPLACE FUNCTION public\.finalise_festival_edition_settlement[\s\S]*?(?=CREATE OR REPLACE FUNCTION public\._festival_effect_completion_guard)/i)?.[0] ?? "";
if (/_festival_apply_outcomes/i.test(finaliser) || /financial_posting_complete|applying_outcomes/i.test(finaliser.match(/s\.state[^;]+/i)?.[0] ?? "")) throw new Error("Festival finalisation bypasses effects_complete.");
if (/requested_payload/i.test(finaliser)) throw new Error("Festival history treats requested payload as an applied result.");
const browserProgressionWrite = festivalFiles.filter(file => file.includes("/settlement/")).some(file => /\.from\(["'`](?:bands|profiles|player_achievements|band_chemistry_snapshots|companies)["'`]\)\s*\.\s*(?:update|insert|upsert)/i.test(contents.get(file)));
if (browserProgressionWrite) throw new Error("Browser Festival code writes canonical progression directly.");
if (!/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.post_festival_edition_settlement\(uuid,integer,uuid\)/i.test(finalSettlementMigration.replaceAll(/\s+/g, " ").replaceAll(/,\s+/g, ","))) {
  throw new Error("The retired monolithic Festival posting RPC is not permanently dropped.");
}
if (tsFiles.some(file => /\bpost_festival_edition_settlement\b/.test(contents.get(file)))) {
  throw new Error("Browser code calls the retired monolithic Festival posting RPC.");
}
for (const forbidden of ["festival_edition_settlement_lines", "festival_edition_settlement_outcomes", "festival_edition_history_snapshots"]) {
  if (festivalFiles.some(file => contents.get(file).includes(`.from("${forbidden}")`) && /\.(insert|update|upsert|delete)\s*\(/.test(contents.get(file)))) throw new Error(`Browser code writes authoritative settlement table ${forbidden}.`);
}

const semantics = param => ({ festivalCompanyId: "festival_company_id", festivalCompanyIdentifier: "festival_company_slug_or_id", editionIdentifier: "annual_edition_id_or_year", companyId: "company_id", editionId: "annual_edition_id", festivalSlug: "festival_slug", participationId: "participation_id", sessionId: "performance_session_id", launchId: "launch_id", resultId: "legacy_festival_id", festivalId: "legacy_festival_id" })[param] || "unknown";
const normalise = route => route.replace(/:[^/]+/g, ":parameter").replace(/\/$/, "");
const routeMatches = [...app.matchAll(/<Route\s+path=(?:"([^"]*festival[^"]*)"|\{festivalRoutePatterns\.(\w+)\})\s+element=\{([^\n]+)/gi)]
  .map(match => ({ raw: match[0], path: match[1] || festivalPatterns[match[2]], element: match[3], index: match.index }));
const activePatterns = new Map();
for (const item of routeMatches) {
  const key = normalise(`/${item.path.replace(/^\//, "")}`);
  if (activePatterns.has(key)) throw new Error(`Duplicate semantic Festival route: ${activePatterns.get(key)} and ${item.path}`);
  activePatterns.set(key, item.path);
}
const routeRows = routeMatches.sort((a,b)=>a.index-b.index).map((match, index) => {
  const route = `/${match.path.replace(/^\//, "")}`;
  const component = match.element.match(/<([A-Z][A-Za-z0-9]*)/)?.[1] || "unknown";
  const params = [...route.matchAll(/:([A-Za-z0-9_]+)/g)].map(item => ({ parameter: item[1], meaning: semantics(item[1]) }));
  const legacy = /Legacy|FestivalDetail|FestivalMarketplace|FestivalDirectory|FestivalPerformance/.test(match.element);
  return { route, component, intendedActor: route.startsWith("/admin") ? "administrator" : /manage|run|festival-company/.test(route) ? "festival owner" : "player/public", identifierSemantics: params, dataSource: legacy ? "legacy compatibility read or canonical resolver" : "festival-company repositories/RPCs", writeApis: [], featureFlag: /LegacyFestivalGate/.test(match.element) ? "legacyFestivalReadEnabled" : null, navigationEntryPoints: [], emptyState: "component-owned", errorState: params.length ? "typed domain state" : "component-owned", canonicalReplacement: legacy ? "/world/festivals" : null, disposition: legacy ? "redirect_temporarily" : "keep", sourceOrder: index + 1, duplicate: false };
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
  return { name, typescriptCallers: callers.filter(f => /\.tsx?$/.test(f)), sqlCallers: callers.filter(f => f.includes("migrations/")), workerCallers: callers.filter(f => f.includes("functions/") || f.includes("scripts/")), testCallers: callers.filter(f => f.includes("tests/") || /\.test\./.test(f)), classification: name === "post_festival_edition_settlement" ? "retired_unavailable" : runtime.length ? (legacy ? "active_legacy" : "active_canonical") : callers.some(f => f.includes("tests/")) ? "test_only" : "no_known_runtime_callers", dynamicCallerReviewRequired: name !== "post_festival_edition_settlement" };
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
