#!/usr/bin/env node
// Read-only source/history inventory for #4072. NEVER executes SQL or connects to DB.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SQL_FILE = /^(\d{14})_(.+)\.sql$/i;
const sha256 = (content) => createHash("sha256").update(content).digest("hex");

/**
 * Names and hashes are evidence for reconciliation, NOT proof that a
 * migration's effects exist in a database. In particular, production may
 * have deployment-prefix versions or renamed files.
 */
export function buildMigrationIdentityInventory(files, recordedVersions = null) {
  const knownHistory = recordedVersions === null ? null : new Map();
  if (knownHistory) {
    for (const evidence of recordedVersions) {
      const version = String(typeof evidence === "object" ? evidence.version : evidence);
      const digest = typeof evidence === "object" ? evidence.sha256 ?? null : null;
      if (!/^\d{14,}$/.test(version) ||
          (digest !== null && !/^[a-f\d]{64}$/i.test(String(digest)))) {
        throw new Error("Invalid migration history version or SQL content hash");
      }
      if (!knownHistory.has(version)) knownHistory.set(version, new Set());
      if (digest !== null) knownHistory.get(version).add(String(digest).toLowerCase());
    }
  }
  const entries = files.map(({ path, content }) => {
    const match = SQL_FILE.exec(basename(path));
    if (!match) throw new Error("Invalid migration filename: " + path);
    const version = match[1], digest = sha256(content);
    const matchingHashes = knownHistory?.get(version);
    return {
      path, version, description: match[2],
      sha256: digest,
      history_identity: knownHistory === null ? "not_provided"
        : knownHistory.has(version) ? "version_matched_unverified" : "version_missing_unverified",
      // Even an exact content match cannot prove an RPC, grant or data effect
      // is still live. An unequal known SQL hash is a mandatory release stop.
      history_sql_hash: knownHistory === null ? "not_provided"
        : !matchingHashes ? "version_not_matched"
        : matchingHashes.size === 0 ? "not_provided"
        : matchingHashes.has(digest) ? "source_hash_matched_schema_unverified"
        : "source_hash_mismatch_manual_review",
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
    // Conflicting claimed SQL for one history version is not deployable.
    history_hash_collision_versions: knownHistory === null ? [] :
      [...knownHistory.entries()].filter(([, hashes]) => hashes.size > 1)
        .map(([version]) => version).sort(),
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

/** Strictly validate optional source-content evidence without implying it was
 * actually applied. Plain version arrays remain supported. */
export function recordedHistoryEvidenceFromJson(input) {
  if (!Array.isArray(input)) throw new Error("History JSON must be an array.");
  return input.map((item) => {
    const version = typeof item === "string" || typeof item === "number"
      ? String(item) : item && typeof item === "object" ? String(item.version ?? "") : "";
    if (!/^\d{14,}$/.test(version)) throw new Error("History JSON has a nonnumeric migration version.");
    const digest = item && typeof item === "object" && item.sha256 != null
      ? String(item.sha256).toLowerCase() : null;
    if (digest !== null && !/^[0-9a-f]{64}$/.test(digest))
      throw new Error("History JSON has an invalid SQL SHA256 digest.");
    return digest === null ? { version } : { version, sha256: digest };
  });
}

export function recordedVersionsFromJson(input) {
  if (!Array.isArray(input)) throw new Error("History JSON must be an array.");
  return input.map((item) => {
    const version = typeof item === "string" || typeof item === "number"
      ? String(item) : item && typeof item === "object" ? String(item.version ?? "") : "";
    if (!/^\d{14,}$/.test(version)) throw new Error("History JSON has a nonnumeric migration version.");
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
    ? recordedHistoryEvidenceFromJson(JSON.parse(readFileSync(resolve(historyPath), "utf8")))
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
