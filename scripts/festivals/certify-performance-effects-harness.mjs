import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const lifecycleFunctions = [
  "claim_next_festival_settlement_effect",
  "apply_festival_performance_result_effect",
  "apply_festival_band_fans_effect",
  "apply_festival_band_fame_effect",
  "apply_festival_member_xp_effect",
  "apply_festival_band_chemistry_effect",
  "apply_festival_song_familiarity_effect",
  "apply_festival_song_popularity_effect",
  "acknowledge_festival_settlement_effect",
  "finalise_festival_settlement_effects",
];

const fixtureTables = [
  "festival_companies", "festivals", "festival_editions",
  "festival_runtime_performances", "festival_edition_settlements",
  "festival_edition_settlement_outcomes", "festival_edition_settlement_effects",
];

/** Remove material which PostgreSQL cannot execute. Dollar-quoted procedure
 * bodies are deliberately retained: SELECT/PERFORM calls in a DO block execute.
 */
export function executableSql(sql) {
  let output = "";
  let index = 0;
  let state = "code";
  let dollarTag = "";
  while (index < sql.length) {
    const pair = sql.slice(index, index + 2);
    if (state === "line") {
      if (sql[index] === "\n") { state = "code"; output += "\n"; }
      else output += " ";
      index += 1; continue;
    }
    if (state === "block") {
      if (pair === "*/") { output += "  "; index += 2; state = "code"; }
      else { output += sql[index] === "\n" ? "\n" : " "; index += 1; }
      continue;
    }
    if (state === "string") {
      if (sql[index] === "'" && sql[index + 1] === "'") { output += "  "; index += 2; }
      else if (sql[index] === "'") { output += " "; index += 1; state = "code"; }
      else { output += sql[index] === "\n" ? "\n" : " "; index += 1; }
      continue;
    }
    if (state === "dollar") {
      if (sql.startsWith(dollarTag, index)) { output += dollarTag; index += dollarTag.length; state = "code"; }
      else { output += sql[index]; index += 1; }
      continue;
    }
    if (pair === "--") { output += "  "; index += 2; state = "line"; continue; }
    if (pair === "/*") { output += "  "; index += 2; state = "block"; continue; }
    if (sql[index] === "'") { output += " "; index += 1; state = "string"; continue; }
    const dollar = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/)?.[0];
    if (dollar) { dollarTag = dollar; output += dollar; index += dollar.length; state = "dollar"; continue; }
    output += sql[index]; index += 1;
  }
  return output;
}

export function certifyPerformanceEffectsHarness(sql) {
  const executable = executableSql(sql);
  const failures = [];
  if (!/^\s*\\set\s+ON_ERROR_STOP\s+(?:on|1)\b/im.test(executable)) failures.push("ON_ERROR_STOP");
  if (!/\bBEGIN\s*;/i.test(executable) || !/\bROLLBACK\s*;/i.test(executable)) failures.push("transactional ROLLBACK");

  for (const fn of lifecycleFunctions) {
    // This is a call expression, not mere occurrence: it must follow an
    // executable SQL invocation/assignment keyword and contain arguments.
    const call = new RegExp(`\\b(?:select|perform|call|:=)\\s+(?:public\\.)?${fn}\\s*\\([^;]*?\\)`, "i");
    if (!call.test(executable)) failures.push(`executable call ${fn}`);
  }
  for (const table of fixtureTables) {
    if (!new RegExp(`\\binsert\\s+into\\s+(?:public\\.)?${table}\\b`, "i").test(executable)) failures.push(`persisted fixture ${table}`);
  }
  if (/\bupdate\s+(?:public\.)?festival_edition_settlement_effects\b[\s\S]{0,500}?\bset\s+[\s\S]{0,200}?\b(?:status|applied_at)\s*=/i.test(executable))
    failures.push("effect lifecycle bypass");
  if (!/\b(?:raise\s+exception|assert)\b/i.test(executable) || !/\b(?:replay|duplicate|idempotent)[A-Za-z_0-9]*\b/i.test(executable)) failures.push("executable replay assertion");
  if (failures.length) throw new Error(`progression harness missing required coverage: ${failures.join(", ")}`);
  return { lifecycleCalls: lifecycleFunctions.length, persistedFixtureKinds: fixtureTables.length };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const sql = readFileSync(new URL("../../supabase/tests/live_performance_progression_harness.sql", import.meta.url), "utf8");
  const result = certifyPerformanceEffectsHarness(sql);
  console.log(`Festival progression harness contract: ${result.lifecycleCalls} executable lifecycle calls; ${result.persistedFixtureKinds} persisted fixture kinds`);
}
