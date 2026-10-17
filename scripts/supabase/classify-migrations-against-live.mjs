#!/usr/bin/env node
// Read-only classifier: fingerprints each repository migration by the objects it
// creates (tables, views, functions, policies, triggers) and compares them with a
// live schema snapshot. It never connects to or changes a database.
//
// Usage:
//   node scripts/supabase/classify-migrations-against-live.mjs \
//     --snapshot /secure/live-snapshot.json --history /secure/history.txt \
//     --output /secure/migration-classification.json
//
// snapshot JSON: { tables[], views[], functions[], policies["table|policy"], triggers[] }
// history file: one applied version per line (optional).
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const IDENT = String.raw`(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?`;
const PATTERNS = {
  tables: new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${IDENT}`, "gi"),
  views: new RegExp(String.raw`create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?${IDENT}`, "gi"),
  functions: new RegExp(String.raw`create\s+(?:or\s+replace\s+)?function\s+${IDENT}`, "gi"),
  triggers: new RegExp(String.raw`create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+"?([A-Za-z_][A-Za-z0-9_]*)"?`, "gi"),
  policies: /create\s+policy\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s+on\s+(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
};
const DROPS = {
  tables: new RegExp(String.raw`drop\s+table\s+(?:if\s+exists\s+)?${IDENT}`, "gi"),
  views: new RegExp(String.raw`drop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?${IDENT}`, "gi"),
  functions: new RegExp(String.raw`drop\s+function\s+(?:if\s+exists\s+)?${IDENT}`, "gi"),
};

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

export function fingerprint(sql) {
  const clean = stripComments(sql);
  const out = {};
  for (const [kind, re] of Object.entries(PATTERNS)) {
    const found = new Set();
    for (const m of clean.matchAll(re)) {
      if (kind === "policies") found.add(`${m[3]}|${m[1] ?? m[2]}`);
      else found.add(m[1].toLowerCase());
    }
    out[kind] = [...found];
  }
  out.drops = {};
  for (const [kind, re] of Object.entries(DROPS)) {
    out.drops[kind] = [...new Set([...clean.matchAll(re)].map((m) => m[1].toLowerCase()))];
  }
  return out;
}

export function classify(fp, live, laterDrops) {
  let expected = 0;
  let present = 0;
  const missing = [];
  for (const kind of ["tables", "views", "functions", "policies", "triggers"]) {
    for (const name of fp[kind]) {
      // Objects removed by a later migration are not expected to exist.
      if (laterDrops[kind]?.has(name)) continue;
      expected += 1;
      if (live[kind].has(kind === "policies" ? name : name.toLowerCase())) present += 1;
      else missing.push(`${kind}:${name}`);
    }
  }
  if (expected === 0) return { status: "unverifiable", expected, present, missing };
  if (present === expected) return { status: "applied", expected, present, missing };
  if (present === 0) return { status: "missing", expected, present, missing };
  return { status: "partial", expected, present, missing };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function main() {
  const snapshotPath = arg("--snapshot");
  const outputPath = arg("--output");
  if (!snapshotPath || !outputPath) {
    console.error("--snapshot and --output are required");
    process.exit(2);
  }
  if (existsSync(outputPath)) {
    console.error(`Refusing to overwrite ${outputPath}`);
    process.exit(2);
  }
  const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const live = {
    tables: new Set((snap.tables ?? []).map((s) => s.toLowerCase())),
    views: new Set((snap.views ?? []).map((s) => s.toLowerCase())),
    functions: new Set((snap.functions ?? []).map((s) => s.toLowerCase())),
    triggers: new Set((snap.triggers ?? []).map((s) => s.toLowerCase())),
    policies: new Set(snap.policies ?? []),
  };
  // Views live in the table list of information_schema.tables too.
  for (const v of live.views) live.tables.add(v);
  for (const t of live.tables) live.views.add(t);
  const historyPath = arg("--history");
  const history = historyPath ? new Set(readFileSync(historyPath, "utf8").split(/\s+/).filter(Boolean)) : null;

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const fps = files.map((f) => ({ file: f, fp: fingerprint(readFileSync(join(dir, f), "utf8")) }));

  const rows = fps.map(({ file, fp }, index) => {
    const laterDrops = { tables: new Set(), views: new Set(), functions: new Set() };
    for (const later of fps.slice(index + 1)) {
      for (const k of Object.keys(laterDrops)) for (const n of later.fp.drops[k]) laterDrops[k].add(n);
    }
    const version = (file.match(/^(\d+)_/) ?? [])[1] ?? null;
    const result = classify(fp, live, laterDrops);
    return {
      file,
      version,
      recordedInHistory: history ? history.has(version) : null,
      ...result,
      missing: result.missing.slice(0, 25),
      missingCount: result.missing.length,
    };
  });

  const summary = {};
  for (const r of rows) summary[r.status] = (summary[r.status] ?? 0) + 1;
  writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(summary));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
