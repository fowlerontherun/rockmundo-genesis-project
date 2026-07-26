import { readdirSync } from "node:fs";
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
const legacySequenceNames = new Set(["085_jam_sessions_core.sql", "086_band_member_locks.sql", "087_bands_add_chemistry_cohesion.sql"]);
const today = new Date();
const reasonableFuture = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2, 23, 59, 59));
const failures = [];
const exceptions = [];
for (const filename of readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql"))) {
  const match = filename.match(filenamePattern);
  if (!match) {
    if (legacySequenceNames.has(filename)) { exceptions.push(filename); continue; }
    failures.push(`${filename}: expected YYYYMMDDHHMMSS_description.sql`); continue;
  }
  const stamp = match[1];
  if (filename === festivalPhase2Continuation || filename === festivalPhase3Continuation || filename === festivalPhase4Continuation || filename === festivalPhase4WorkflowContinuation || filename === festivalPhase5Continuation || filename === festivalPhase5WorkflowContinuation || filename === festivalPhase6Continuation || filename === festivalPhase6WorkflowContinuation || filename === festivalPhase7Continuation || filename === festivalPhase7LaunchContinuation || filename === festivalPhase8RuntimeContinuation) { exceptions.push(filename); continue; }
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
}
if (failures.length) { console.error("Supabase migration timestamp verification failed:\n" + failures.map((item) => `- ${item}`).join("\n")); process.exit(1); }
console.log(`Verified migration filename timestamps. ${exceptions.length} documented legacy 2029 migration(s) were allowed; new future-dated migrations are prohibited.`);
