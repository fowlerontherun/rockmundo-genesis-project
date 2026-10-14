#!/usr/bin/env node
/**
 * Read-only migration identity manifest. Never connects to or writes production.
 *
 * Usage:
 *   node scripts/supabase/reconcile-migration-history.mjs \
 *     --history private-history.json --output migration-review.json
 *
 * History is a locally exported array of {version, name} records from
 * supabase_migrations.schema_migrations. A version/name match is NOT evidence
 * that a SQL body or schema effect was deployed.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_NAME = /^(\d{14})_(.+)\.sql$/;

export function gitBlobSha(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha1")
    .update(Buffer.from(`blob ${body.length}\0`))
    .update(body)
    .digest("hex");
}

export function buildMigrationManifest(files, history = null) {
  const seen = new Map();
  for (const file of files) {
    const match = basename(file.path).match(MIGRATION_NAME);
    if (!match) continue;
    seen.set(match[1], [...(seen.get(match[1]) ?? []), file.path]);
  }

  const historyRows = history === null ? null : history.map((entry) => {
    if (!entry || typeof entry !== "object" || !/^\d{14}$/.test(String(entry.version ?? ""))) {
      throw new Error("History entries must contain a 14-digit version and optional name");
    }
    return { version: String(entry.version), name: String(entry.name ?? "") };
  });
  const rows = files.map((file) => {
    const name = basename(file.path);
    const match = name.match(MIGRATION_NAME);
    const body = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
    const version = match?.[1] ?? null;
    const recorded = version && historyRows
      ? historyRows.filter((entry) => entry.version === version)
      : [];
    const collision = version ? (seen.get(version) ?? []).length > 1 : false;

    let identityStatus = "history_not_supplied";
    if (!match) identityStatus = "invalid_filename";
    else if (collision) identityStatus = "duplicate_timestamp_ambiguous";
    else if (historyRows && recorded.length > 1) identityStatus = "duplicate_history_ambiguous";
    else if (historyRows && recorded.length === 1) identityStatus = "history_identity_match_only";
    else if (historyRows) identityStatus = "not_recorded_by_version";

    return {
      repo_path: file.path,
      git_blob_sha: gitBlobSha(body),
      sql_sha256: createHash("sha256").update(body).digest("hex"),
      version,
      recorded_migrations: recorded,
      identity_status: identityStatus,
      sql_applied: "unverified",
      schema_status: "unverified",
      dependency_status: "unverified",
      decision: "manual_review_required",
      verification: null,
    };
  }).sort((a, b) => a.repo_path.localeCompare(b.repo_path));

  const summary = rows.reduce((acc, item) => {
    acc[item.identity_status] = (acc[item.identity_status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    generated_at: new Date().toISOString(),
    warning: "An identity match is not proof of applied SQL. No migration is approved for deployment by this manifest.",
    total_files: rows.length,
    summary,
    rows,
  };
}

export function readMigrationFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({
      path: `supabase/migrations/${name}`,
      body: readFileSync(join(directory, name)),
    }));
}

export function parseArgs(argv) {
  const args = { history: null, output: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!["--history", "--output"].includes(key) || !value || value.startsWith("--")) {
      throw new Error("Usage: reconcile-migration-history.mjs [--history exported-history.json] [--output manifest.json]");
    }
    if (key === "--history") args.history = value;
    if (key === "--output") args.output = value;
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const history = args.history ? JSON.parse(readFileSync(resolve(args.history), "utf8")) : null;
    if (history !== null && !Array.isArray(history)) throw new Error("History JSON must be an array");
    const manifest = buildMigrationManifest(
      readMigrationFiles(join(process.cwd(), "supabase", "migrations")),
      history,
    );
    if (args.output) writeFileSync(resolve(args.output), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({
      total_files: manifest.total_files,
      summary: manifest.summary,
      warning: manifest.warning,
      output: args.output ?? "not written (pass --output)",
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
