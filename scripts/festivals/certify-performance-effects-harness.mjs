import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const lifecycleFunctions = [
  "prepare_festival_edition_settlement",
  "approve_festival_edition_settlement",
  "start_festival_edition_settlement_posting",
  "post_next_festival_edition_settlement_item",
  "finalise_festival_edition_settlement_posting",
  "apply_festival_edition_outcomes",
  "claim_next_festival_settlement_effect",
  "apply_festival_performance_result_effect",
  "apply_festival_band_fans_effect",
  "apply_festival_band_fame_effect",
  "apply_festival_member_xp_effect",
  "apply_festival_band_chemistry_effect",
  "apply_festival_song_familiarity_effect",
  "apply_festival_song_popularity_effect",
  "acknowledge_festival_settlement_effect",
  "finalise_ready_festival_settlement_effects",
  "finalise_festival_edition_settlement",
];

const fixtureTables = [
  "festival_companies", "festivals", "festival_editions_v2",
  "festival_edition_runtimes", "festival_runtime_completion_digests",
  "festival_runtime_performances",
];

/** Strip comments and ordinary quoted strings while retaining dollar-quoted
 * PL/pgSQL bodies. This makes comments and documentation unable to satisfy a
 * lifecycle-call requirement.
 */
export function executableSql(sql) {
  let output = "";
  let index = 0;
  let state = "code";
  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);
    if (state === "line") {
      if (sql[index] === "\n") { state = "code"; output += "\n"; } else output += " ";
      index += 1;
    } else if (state === "block") {
      if (pair === "*/") { output += "  "; index += 2; state = "code"; } else { output += sql[index] === "\n" ? "\n" : " "; index += 1; }
    } else if (state === "string") {
      if (sql[index] === "'" && sql[index + 1] === "'") { output += "  "; index += 2; } else if (sql[index] === "'") { output += " "; index += 1; state = "code"; } else { output += sql[index] === "\n" ? "\n" : " "; index += 1; }
    } else if (pair === "--") { output += "  "; index += 2; state = "line"; }
    else if (pair === "/*") { output += "  "; index += 2; state = "block"; }
    else if (sql[index] === "'") { output += " "; index += 1; state = "string"; }
    else { output += sql[index]; index += 1; }
  }
  return output;
}

function addPatternFailure(failures, sql, pattern, label) {
  if (pattern.test(sql)) failures.push(label);
}

export function certifyPerformanceEffectsHarness(sql) {
  const executable = executableSql(sql);
  const failures = [];
  if (!/^\s*\\set\s+ON_ERROR_STOP\s+(?:on|1)\b/im.test(executable)) failures.push("ON_ERROR_STOP");
  if (!/\bBEGIN\s*;/i.test(executable) || !/\bROLLBACK\s*;/i.test(executable)) failures.push("transactional ROLLBACK");

  addPatternFailure(failures, executable, /\bIF\s+(?:false|1\s*=\s*0)\s+THEN\b/i, "unreachable lifecycle block");
  addPatternFailure(failures, executable, /\bCASE\s+WHEN\s+false\b/i, "unreachable lifecycle block");
  addPatternFailure(failures, executable, /\bDEFAULT\s+VALUES\b/i, "DEFAULT VALUES fixture");
  addPatternFailure(failures, executable, /\bEXCEPTION\s+WHEN\s+OTHERS\s+THEN\s+(?:NULL|CONTINUE)\b/i, "swallowed lifecycle failure");
  addPatternFailure(failures, executable, /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\b/i, "lifecycle calls in harness-defined routine");
  addPatternFailure(failures, executable, /\bapply_festival_(?:performance_result|band_fans|band_fame|member_xp|band_chemistry|song_familiarity|song_popularity)_effect\s*\(\s*(?:NULL\s*,\s*){6}NULL\s*\)/i, "placeholder-only NULL effect call");
  addPatternFailure(failures, executable, /\b(?:claimed_effects|processed_effects|duplicate_canonical_records)\s*:=\s*\d+\b/i, "hard-coded lifecycle count");

  for (const fn of lifecycleFunctions) {
    const call = new RegExp(`\\b(?:select|perform|call|:=|then)\\s+(?:public\\.)?${fn}\\s*\\([^;]+?\\)`, "i");
    if (!call.test(executable)) failures.push(`executable call ${fn}`);
  }
  for (const table of fixtureTables) {
    if (!new RegExp(`\\binsert\\s+into\\s+(?:public\\.)?${table}\\s*\\(`, "i").test(executable)) failures.push(`explicit persisted fixture ${table}`);
  }
  if (/\bCREATE\s+TEMP(?:ORARY)?\s+TABLE\s+(?:public\.)?(?:festivals|festival_editions|festival_runtime_performances)\b/i.test(executable)) failures.push("temporary-table-only domain fixture");
  if (/\bupdate\s+(?:public\.)?festival_edition_settlement_effects\b[\s\S]{0,500}?\bset\s+[\s\S]{0,200}?\b(?:status|applied_at)\s*=/i.test(executable)) failures.push("effect lifecycle bypass");
  if (/\binsert\s+into\s+(?:public\.)?(?:festival_edition_settlement_outcomes|festival_edition_settlement_effects|live_performance_outcomes|band_fan_progression_events|band_fame_progression_events|member_xp_transactions|song_performance_progression_events|festival_effect_authority_results)\b/i.test(executable)) failures.push("fabricated production result");
  for (const field of ["claimed_effects", "processed_effects", "duplicate_canonical_records"]) {
    if (!new RegExp(`\\bselect\\b[\\s\\S]{0,350}\\binto\\s+${field}\\b|\\b${field}\\s*:?=\\s*\\(\\s*select\\b`, "i").test(executable)) failures.push(`database-derived ${field}`);
  }
  if (!/\bFESTIVAL_LIFECYCLE_SUMMARY\b/.test(sql)) failures.push("deterministic lifecycle summary");
  if (!/\b(?:raise\s+exception|assert)\b/i.test(executable) || !/\b(?:replay|duplicate|idempotent|reclaim)[A-Za-z_0-9]*\b/i.test(executable)) failures.push("executable replay assertion");
  if (failures.length) throw new Error(`progression harness missing required coverage: ${failures.join(", ")}`);
  return { lifecycleCalls: lifecycleFunctions.length, persistedFixtureKinds: fixtureTables.length };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const sql = readFileSync(new URL("../../supabase/tests/live_performance_progression_harness.sql", import.meta.url), "utf8");
  const result = certifyPerformanceEffectsHarness(sql);
  console.log(`Festival progression harness contract: ${result.lifecycleCalls} executable lifecycle calls; ${result.persistedFixtureKinds} persisted fixture kinds`);
}
