#!/usr/bin/env node
// Read-only source/history inventory for #4072. NEVER executes SQL or connects to DB.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SQL_FILE = /^(\\d{14})_(.+)\\.sql$/i;
const sha256 = (content) => createHash("sha256").update(content).digest("hex");

/**
 * Names and hashes are evidence for reconciliation, NOT proof that a
 * migration's effects exist in a database. In particular, production may
 * have deployment-prefix versions or renamed files.
 */
export function buildMigrationIdentityInventory(files, recordedVersions = null) {
  const knownHistory = recordedVersions === null ? null
    : new Set(recordedVersions.map((version) => String(version)));
  const entries = files.map(({ path, content }) => {
    const match = SQL_FILE.exec(basename(path));
    if (!match) throw new Error("Invalid migration filename: " + path);
    const version = match[1];
    return {
      path, version, description: match[2],
      sha256: sha256(content),
      history_identity: knownHistory === null ? "not_provided"
        : knownHistory.has(version) ? "version_matched_unverified" : "version_missing_unverified",
      schema_effects: "not_verified",
      deployment_decision: "manual_review_required",
    };
  }).sort((a, b) => a.path.localeCompare(b.path));

  const grouped = (key) => {
    const values = new Map();
    for (const entry of entries) {
      const id = entry[key];
      values.set(id, [...(values.get(id) ?? []), entry.path]);
    }
    return [...values.entries()]
      .filter(([, paths]) => paths.length > 1)
      .map(([value, paths]) => ({ [key]: value, paths }))
      .sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  };
  return {
    format_version: 1,
    source: "read_only_git_worktree",
    generated_file_count: entries.length,
    // Duplicate versions can represent DIFFERENT SQL. Do not collapse them.
    duplicate_timestamp_groups: grouped("version"),
    // Identical SQL with different version/name may be a rename; verify DDL.
    identical_sql_groups: grouped("sha256"),
    warnings: [
      "This inventory never proves a migration was applied. Validate functions, grants, constraints and data before marking applied.",
      "Do not run supabase db push or replay historical SQL based on this report.",
      "Production history may contain deployment-time prefixed versions.",
    ],
    entries,
  };
}

export function readMigrationFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SQL_FILE.test(entry.name))
    .map((entry) => {
      const path = join(directory, entry.name);
      return { path, content: readFileSync(path) };
    });
}

function usage() {
  return "Usage: node scripts/migration-identity-inventory.mjs [--migrations-dir PATH] [--history-json PATH] [--output PATH]";
}

export function recordedVersionsFromJson(input) {
  if (!Array.isArray(input)) throw new Error("History JSON must be an array.");
  return input.map((item) => {
    const version = typeof item === "string" || typeof item === "number"
      ? String(item) : item && typeof item === "object" ? String(item.version ?? "") : "";
    if (!/^\\d{14,}$/.test(version)) throw new Error("History JSON has a nonnumeric migration version.");
    return version;
  });
}

function main(argv) {
  let migrationsDir = "supabase/migrations";
  let historyPath = null;
  let outputPath = null;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i], value = argv[i + 1];
    if (!value || !["--migrations-dir", "--history-json", "--output"].includes(flag)) {
      throw new Error(usage());
    }
    if (flag === "--migrations-dir") migrationsDir = value;
    if (flag === "--history-json") historyPath = value;
    if (flag === "--output") outputPath = value;
  }
  const history = historyPath
    ? recordedVersionsFromJson(JSON.parse(readFileSync(resolve(historyPath), "utf8")))
    : null;
  const manifest = buildMigrationIdentityInventory(readMigrationFiles(resolve(migrationsDir)), history);
  const json = JSON.stringify(manifest, null, 2) + "\n";
  if (outputPath) writeFileSync(resolve(outputPath), json);
  else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(String(error.message ?? error) + "\n"); process.exitCode = 1; }
}
