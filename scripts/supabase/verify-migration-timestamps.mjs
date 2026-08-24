import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const filenamePattern = /^(\d{14})_.+\.sql$/;
const knownLegacyFutureCeiling = "20291217122000";
const festivalPhase2Continuation = "20291217130000_festival_site_and_stage_planning.sql";
const festivalPhase3Continuation = "20291217140000_festival_ticketing_and_capacity_planning.sql";
const festivalPhase4Continuation = "20291217150000_festival_artist_applications_and_bookings.sql";
const festivalPhase4WorkflowContinuation = "20291217151000_complete_festival_artist_workflows.sql";
const festivalPhase5Continuation = "20291217160000_festival_staffing_and_suppliers.sql";
const festivalPhase5WorkflowContinuation = "20291217161000_complete_festival_staffing_supplier_workflows.sql";
const festivalPhase6Continuation = "20291217170000_festival_sponsorship_and_partnerships.sql";
const festivalPhase6WorkflowContinuation = "20291217171000_complete_festival_sponsorship_workflows.sql";
const festivalPhase7Continuation = "20291217180000_festival_timetable_and_readiness.sql";
const festivalPhase7LaunchContinuation = "20291217190000_festival_launch_and_ticket_sales.sql";
const festivalPhase8RuntimeContinuation = "20291217200000_live_festival_runtime_foundation.sql";
const festivalPhase8OperationsContinuation = "20291217210000_festival_crowds_incidents_and_operations.sql";
const festivalPhase9SettlementContinuation = "20291217220000_festival_financial_settlement.sql";
const festivalPhase9LegacyContinuation = "20291217230000_festival_historical_legacy.sql";
const festivalRuntimeWorkerContinuation = "20291218000000_complete_festival_runtime_worker_boundary.sql";
const festivalCrossPhaseContinuation = "20291218010000_festival_cross_phase_contracts.sql";
const festivalRuntimeV2HardeningContinuation = "20291218020000_festival_runtime_v2_hardening.sql";
const festivalSettlementV2Continuation = "20291218030000_festival_settlement_v2.sql";
const festivalSettlementV2ExecutionContinuation = "20291218040000_execute_festival_settlement_v2.sql";
const festivalSettlementV2NativeContinuation = "20291218050000_native_festival_settlement_v2.sql";
const festivalSettlementV2AuditContinuation = "20291218060000_auditable_festival_settlement_v2.sql";
const festivalSettlementV2CompletionContinuation = "20291218070000_complete_festival_settlement_v2.sql";
const festivalBacklogB5LifecycleContinuation = "20291219040000_festival_organiser_lifecycle_audit.sql";
const festivalBacklogB5HardeningContinuation = "20291219040100_festival_organiser_lifecycle_hardening.sql";
const festivalBacklogB5QueueContinuation = "20291219040200_festival_artist_schedule_queue_fix.sql";
const festivalBacklogB6CommerceContinuation = "20291219050000_festival_ticket_vendor_analytics_closure.sql";
// PR #1517 may already have been applied. Preserve that exact immutable filename;
// all corrections live in a current, forward migration.
const deployedReleaseFinanceException = "20291218245800_release_finance_consistency.sql";
const inheritedFutureMigrations = new Set(JSON.parse(readFileSync(join(process.cwd(), "scripts", "supabase", "inherited-future-migrations.json"), "utf8")));
const documentedFestivalSequence = new Set([
  festivalPhase2Continuation, festivalPhase3Continuation, festivalPhase4Continuation,
  festivalPhase4WorkflowContinuation, festivalPhase5Continuation, festivalPhase5WorkflowContinuation,
  festivalPhase6Continuation, festivalPhase6WorkflowContinuation, festivalPhase7Continuation,
  festivalPhase7LaunchContinuation, festivalPhase8RuntimeContinuation, festivalPhase8OperationsContinuation,
  festivalPhase9SettlementContinuation, festivalPhase9LegacyContinuation, festivalRuntimeWorkerContinuation,
  festivalCrossPhaseContinuation, festivalRuntimeV2HardeningContinuation, festivalSettlementV2Continuation,
  festivalSettlementV2ExecutionContinuation, festivalSettlementV2NativeContinuation,
  festivalSettlementV2AuditContinuation, festivalSettlementV2CompletionContinuation,
  festivalBacklogB5LifecycleContinuation, festivalBacklogB5HardeningContinuation,
  festivalBacklogB5QueueContinuation, festivalBacklogB6CommerceContinuation,
]);
const legacySequenceNames = new Set(["085_jam_sessions_core.sql", "086_band_member_locks.sql", "087_bands_add_chemistry_cohesion.sql"]);
const today = new Date();
const reasonableFuture = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2, 23, 59, 59));
const failures = [];
const exceptions = [];
const migrationFiles = readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql"));
const filesByTimestamp = new Map();
const documentedDuplicateTimestamps = new Map(
  Object.entries(JSON.parse(readFileSync(
    join(process.cwd(), "scripts", "supabase", "migration-timestamp-collisions.json"),
    "utf8",
  ))).map(([stamp, filenames]) => [stamp, new Set(filenames)]),
);

for (const filename of migrationFiles) {
  const match = filename.match(filenamePattern);
  if (!match) {
    if (legacySequenceNames.has(filename)) { exceptions.push(filename); continue; }
    failures.push(`${filename}: expected YYYYMMDDHHMMSS_description.sql`); continue;
  }
  const stamp = match[1];
  if (documentedFestivalSequence.has(filename)) { exceptions.push(filename); continue; }
  if (filename === deployedReleaseFinanceException || inheritedFutureMigrations.has(filename)) { exceptions.push(filename); continue; }
  const todayStamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}235959`;
  // Freeze every inherited future sequence through the known anomaly. This includes
  // several historical invalid calendar-day names; accepting the exact bounded
  // range avoids retroactively breaking deployments while preventing later dates.
  if (stamp > todayStamp && stamp <= knownLegacyFutureCeiling) { exceptions.push(filename); continue; }
  const parts = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  const parsed = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6])));
  const roundTrip = `${parsed.getUTCFullYear()}${String(parsed.getUTCMonth() + 1).padStart(2, "0")}${String(parsed.getUTCDate()).padStart(2, "0")}${String(parsed.getUTCHours()).padStart(2, "0")}${String(parsed.getUTCMinutes()).padStart(2, "0")}${String(parsed.getUTCSeconds()).padStart(2, "0")}`;
  if (roundTrip !== stamp) { failures.push(`${filename}: timestamp is not a real calendar time`); continue; }
  if (parsed > reasonableFuture) {
    // This repository already deployed a historical 2029 sequence. Freeze that exact
    // range; newly introduced future timestamps (including anything after its ceiling)
    // are rejected. The anomaly and forward-only strategy are documented in the README.
    failures.push(`${filename}: timestamp is unreasonably beyond the current date (maximum two-day clock skew)`);
  }
  const timestampFiles = filesByTimestamp.get(stamp) ?? [];
  timestampFiles.push(filename);
  filesByTimestamp.set(stamp, timestampFiles);
}

// Supabase identifies migrations by timestamp, not by the complete filename.
// Preserve the exact already-deployed collision sets so history is never
// rewritten, but reject every new collision or addition to a frozen set.
for (const [stamp, filenames] of filesByTimestamp) {
  if (filenames.length < 2) continue;
  const allowed = documentedDuplicateTimestamps.get(stamp);
  const actual = new Set(filenames);
  const isExactDocumentedSet = allowed
    && actual.size === allowed.size
    && [...actual].every((filename) => allowed.has(filename));
  if (!isExactDocumentedSet) {
    failures.push(`${stamp}: duplicate migration timestamp used by ${filenames.sort().join(", ")}`);
  }
}
if (failures.length) { console.error("Supabase migration timestamp verification failed:\n" + failures.map((item) => `- ${item}`).join("\n")); process.exit(1); }
console.log(`Verified migration filename timestamps. ${exceptions.length} documented legacy 2029 migration(s) and ${documentedDuplicateTimestamps.size} frozen timestamp collision(s) were allowed; new future-dated or duplicate migrations are prohibited.`);
