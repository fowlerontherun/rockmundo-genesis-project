// Run after deploying the festival NPC and canonical schedule migrations.
// Read-only schema gate: fails loudly instead of rendering an apparently empty festival.
import { readFileSync } from "node:fs";

const required = [
  "festival_owner_npc_lineup_acts",
  "festival_schedule_revisions",
  "festival_schedule_items",
  "festival_stage_slots",
  "festival_artist_bookings",
];
const functions = [
  "festival_public_projection_v2(uuid)",
  "_festival_simplified_timetable_projection(uuid)",
  "get_festival_owner_npc_lineup_acts(uuid,uuid)",
  "upsert_festival_owner_npc_lineup_act(uuid,uuid,uuid,text,text,integer,integer,date,uuid,text,uuid)",
];
const sql = `SELECT jsonb_build_object(
  'tables', (SELECT jsonb_object_agg(t.name, to_regclass('public.' || t.name) IS NOT NULL)
             FROM unnest(ARRAY[${required.map(x=>"'"+x+"'").join(",")}]) t(name)),
  'functions', (SELECT jsonb_object_agg(f.name, to_regprocedure('public.' || f.name) IS NOT NULL)
                FROM unnest(ARRAY[${functions.map(x=>"'"+x+"'").join(",")}]) f(name))
) AS festival_schema_gate;`;
if (process.argv.includes("--sql")) {
  process.stdout.write(sql + "\n");
} else {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("Usage: node scripts/supabase/verify-festival-owner-public-schema.mjs --sql | <query-result.json>\n");
    process.exitCode = 2;
  } else {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    const report = raw.festival_schema_gate ?? raw[0]?.festival_schema_gate ?? raw;
    const missing = Object.entries({ ...report.tables, ...report.functions }).filter(([, ok]) => ok !== true);
    if (missing.length) {
      process.stderr.write("Festival schema missing: " + missing.map(([name]) => name).join(", ") + "\n");
      process.exitCode = 1;
    } else {
      process.stdout.write("Festival owner/public schema prerequisites present.\n");
    }
  }
}
