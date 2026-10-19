#!/usr/bin/env node
// Read-only inventory. Never applies SQL, renames files or edits migration history.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const versioned = /^(\d{14})_(.+)\.sql$/;
// A timestamp is a migration identity. Validate its actual UTC calendar time.
export function isValidTimestamp(value) {
  if (!/^\d{14}$/.test(value)) return false;
  const iso = value.slice(0,4) + "-" + value.slice(4,6) + "-" +
    value.slice(6,8) + "T" + value.slice(8,10) + ":" +
    value.slice(10,12) + ":" + value.slice(12,14) + "Z";
  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().replace(/\D/g, "").slice(0,14) === value;
}
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

// One history walk handles the overwhelming majority of paths. Only Git-renamed
// paths fall back to the more expensive per-file --follow scan.
export function bulkGitIntroductions(root) {
  const raw = git(root, ["log", "--find-renames", "--diff-filter=A",
    "--format=%H%x09%cI", "--name-only", "--", "supabase/migrations"]);
  const found = new Map();
  let current = null;
  for (const line of raw.split("\n")) {
    const match = /^([0-9a-f]{40})\t(\d{4}-\d\d-\d\dT\S+)$/.exec(line);
    if (match) {
      current = { commit: match[1], created_at: match[2],
        utc_timestamp: new Date(match[2]).toISOString().replace(/\D/g, "").slice(0, 14) };
    } else if (current && line.startsWith("supabase/migrations/") && line.endsWith(".sql")) {
      // History is reverse-chronological; the last addition is the earliest one.
      found.set(line, current);
    }
  }
  return found;
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
  const bulk = bulkGitIntroductions(root);
  const entries = filenames.map(name => {
    const match = versioned.exec(name);
    const introduction = bulk.get("supabase/migrations/" + name)
      || firstGitIntroduction(root, "supabase/migrations/" + name);
    const existing = match?.[1] || null;
    const actual = introduction?.utc_timestamp || null;
    const matches = existing && actual ? existing.slice(0, 8) === actual.slice(0, 8) : null;
    // The Dec 17–20 2029 Festival namespace, inherited exceptions and
    // additional known Festival continuation are preserved as version identities.
    const protected_identity = Boolean(existing && (
      (existing >= "20291217000000" && existing < "20291221000000") ||
      existing.startsWith("20300101")
    )) || inherited.has(name);
    const timestamp_valid = existing ? isValidTimestamp(existing) : null;
    const proposed_filename = !matches && actual && match
      ? actual + "_" + match[2] + ".sql" : null;
    const classification = !existing ? "legacy_format_manual_review"
      : !introduction ? "git_introduction_unavailable"
      : !timestamp_valid ? (protected_identity ? "invalid_timestamp_protected_identity" : "invalid_timestamp_manual_review")
      : matches ? "matching_calendar_date"
      : protected_identity ? "mismatch_protected_identity"
      : "mismatch_requires_live_history_and_schema_review";
    return { path: "supabase/migrations/" + name, filename_timestamp: existing,
      first_git_introduction: introduction, protected_identity, timestamp_valid,
      proposed_filename, duplicate_version: existing ? used.get(existing) > 1 : false,
      proposed_timestamp_collision: false, classification };
  });
  // A proposed target can conflict with an existing version OR with another
  // proposal. Supabase keys by version, not the rest of the filename.
  const proposals = new Map();
  for (const entry of entries) {
    if (!entry.proposed_filename) continue;
    const key = entry.proposed_filename.slice(0,14);
    proposals.set(key, (proposals.get(key) || 0) + 1);
  }
  for (const entry of entries) {
    if (!entry.proposed_filename) continue;
    const key = entry.proposed_filename.slice(0,14);
    entry.proposed_timestamp_collision = used.has(key) || proposals.get(key) > 1;
    if (entry.proposed_timestamp_collision &&
        entry.classification === "mismatch_requires_live_history_and_schema_review")
      entry.classification = "mismatch_proposed_version_collision";
  }
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
