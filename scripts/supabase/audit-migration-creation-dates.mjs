#!/usr/bin/env node
// Read-only inventory. Never applies SQL, renames files or edits migration history.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const versioned = /^(\d{14})_(.+)\.sql$/;
const git = (root, args) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
}).trim();

export function firstGitIntroduction(root, path) {
  const lines = git(root, ["log", "--follow", "--diff-filter=A", "--format=%H%x09%cI", "--", path])
    .split("\n").filter(Boolean);
  if (!lines.length) return null;
  const [commit, created_at] = lines.at(-1).split("\t");
  if (!/^[0-9a-f]{40}$/.test(commit) || Number.isNaN(Date.parse(created_at))) return null;
  return { commit, created_at, utc_timestamp: new Date(created_at).toISOString().replace(/\D/g, "").slice(0, 14) };
}

export function auditCreationDates(root) {
  if (git(root, ["rev-parse", "--is-shallow-repository"]) === "true")
    throw new Error("Full Git history required. In GitHub Actions, use actions/checkout with fetch-depth: 0.");
  const filenames = readdirSync(join(root, "supabase", "migrations"))
    .filter(name => name.endsWith(".sql")).sort();
  const inherited = new Set(JSON.parse(readFileSync(join(root, "scripts", "supabase", "inherited-future-migrations.json"), "utf8")));
  const used = new Map();
  for (const name of filenames) {
    const match = versioned.exec(name);
    if (match) used.set(match[1], (used.get(match[1]) || 0) + 1);
  }
  const entries = filenames.map(name => {
    const match = versioned.exec(name);
    const introduction = firstGitIntroduction(root, "supabase/migrations/" + name);
    const existing = match?.[1] || null;
    const actual = introduction?.utc_timestamp || null;
    const matches = existing && actual ? existing.slice(0, 8) === actual.slice(0, 8) : null;
    // The Dec 17–20 2029 Festival namespace and inherited exceptions are protected.
    const protected_identity = Boolean(existing && existing >= "20291217000000" && existing < "20291221000000") || inherited.has(name);
    const classification = !existing ? "legacy_format_manual_review"
      : !introduction ? "git_introduction_unavailable"
      : matches ? "matching_calendar_date"
      : protected_identity ? "mismatch_protected_identity"
      : "mismatch_requires_live_history_and_schema_review";
    return { path: "supabase/migrations/" + name, filename_timestamp: existing,
      first_git_introduction: introduction, protected_identity,
      duplicate_version: existing ? used.get(existing) > 1 : false, classification };
  });
  const counts = {};
  for (const entry of entries) counts[entry.classification] = (counts[entry.classification] || 0) + 1;
  return { format_version: 1, source: "full_git_history", read_only: true,
    file_count: entries.length, counts,
    warnings: ["Original Git commit date is NOT proof of database deployment date.",
      "Never mass-rename a deployed Supabase migration; check live schema and ledger, then stage dependencies.",
      "This tool cannot determine whether SQL was manually applied outside the migration ledger."],
    entries };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--output"))
      throw new Error("Usage: node scripts/supabase/audit-migration-creation-dates.mjs [--output PATH]");
    const report = auditCreationDates(process.cwd());
    const json = JSON.stringify(report, null, 2) + "\n";
    if (args.length) writeFileSync(args[1], json);
    else process.stdout.write(json);
    console.error("Audited " + report.file_count + " migrations: " + JSON.stringify(report.counts));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
