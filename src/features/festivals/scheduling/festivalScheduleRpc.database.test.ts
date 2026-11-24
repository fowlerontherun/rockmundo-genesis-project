// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { festivalScheduleSlotWindow } from "./festivalScheduleLocalTime";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migrationDir = "supabase/migrations";
const baselineFile = readdirSync(migrationDir).find((name) => name.startsWith("20260816141028_"))!;
const baseline = readFileSync(`${migrationDir}/${baselineFile}`, "utf8")
  .match(/CREATE OR REPLACE FUNCTION public\.festival_schedule_upsert_item\([\s\S]+?END \$\$;/)![0];
const guard = readFileSync("supabase/reconciliation/festival/20261030_strict_festival_slot_saves.sql", "utf8");

it("persists one canonical slot across session timezones and rejects unsafe writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA private;
      CREATE TABLE festival_editions(id uuid PRIMARY KEY, festival_id uuid, timezone text, start_at timestamptz);
      CREATE TABLE festival_stages(id uuid PRIMARY KEY, edition_id uuid, archived_at timestamptz);
      CREATE TABLE festival_stage_slots(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stage_id uuid, festival_id uuid, edition_id uuid,
        day_number integer, slot_number integer, slot_type text, band_id uuid, start_time timestamptz,
        end_time timestamptz, status text, changeover_minutes integer, canonical_contract_id uuid,
        UNIQUE(stage_id,day_number,slot_number)
      );
      CREATE FUNCTION public.can_manage_festival_edition(uuid) RETURNS boolean LANGUAGE sql AS
        'SELECT current_setting(''test.festival_owner'',true) = ''yes''';
      CREATE FUNCTION public.festival_edition_schedule_workspace(uuid) RETURNS jsonb LANGUAGE sql AS
        'SELECT jsonb_build_object(''scheduleItems'',coalesce(jsonb_agg(to_jsonb(s)),''[]''::jsonb))
           FROM public.festival_stage_slots s WHERE s.edition_id=$1';
      INSERT INTO festival_editions VALUES ('${id(1)}','${id(2)}','Europe/London','2026-03-28T00:00:00Z'),
        ('${id(4)}','${id(2)}','Europe/London','2026-03-28T00:00:00Z');
      INSERT INTO festival_stages VALUES ('${id(3)}','${id(1)}',NULL), ('${id(5)}','${id(4)}',NULL);
    `);
    await db.exec(baseline);
    await db.exec(guard);
    const call = (item: Record<string, unknown>, key = "manual:fixture1") => db.query(
      "SELECT festival_schedule_upsert_item($1,$1,$2,1,$3) AS workspace", [id(1), item, key],
    );
    const window = festivalScheduleSlotWindow("2026-03-28", "23:45", 180, "Europe/London");
    const input = { stage_id: id(3), festival_date: "2026-03-28",
      starts_at: window.startsAt, ends_at: window.endsAt, duration_minutes: 180 };

    await db.exec("SET ROLE anon");
    await expect(call(input)).rejects.toThrow("permission denied");
    await db.exec("SET ROLE authenticated");
    await expect(call(input)).rejects.toThrow("FESTIVAL_SCHEDULE_PERMISSION_DENIED");
    await expect(db.query("SELECT * FROM private.festival_schedule_slot_upsert_receipts")).rejects.toThrow("permission denied");
    await db.exec("SET test.festival_owner = 'yes'; SET TIME ZONE 'America/Los_Angeles'");
    const first = await call(input);
    await db.exec("SET TIME ZONE 'Asia/Tokyo'");
    const retry = await call(input);
    const slots = (result: typeof first) => (result.rows[0] as { workspace: { scheduleItems: { id: string }[] } }).workspace.scheduleItems;
    expect(slots(first)).toHaveLength(1);
    expect(slots(retry)).toHaveLength(1);
    expect(slots(retry)[0].id).toBe(slots(first)[0].id);
    await expect(call({ ...input, ends_at: "2026-03-29T02:46:00Z" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(call({ ...input, ends_at: "2026-03-29T02:46:00Z" }, "manual:duration")).rejects.toThrow("DURATION_MISMATCH");
    await expect(call({ ...input, starts_at: "2026-03-28T23:45:00" }, "manual:naive")).rejects.toThrow("EXPLICIT_TIMEZONE_REQUIRED");
    await expect(call({ ...input, festival_date: "2026-03-29" }, "manual:wrong-day")).rejects.toThrow("WRONG_LOCAL_DAY");
    await expect(call({ ...input, stage_id: id(5) }, "manual:wrong-stage")).rejects.toThrow("STAGE_MISMATCH");
    await expect(call({ ...input, stage_slot_id: id(9) }, "manual:missing")).rejects.toThrow("ITEM_NOT_FOUND");

    await db.exec("RESET ROLE");
    expect((await db.query(`
      SELECT day_number, (start_time AT TIME ZONE 'Europe/London')::text AS start_local,
        (end_time AT TIME ZONE 'Europe/London')::text AS end_local,
        extract(epoch FROM end_time-start_time)::int AS seconds
      FROM festival_stage_slots
    `)).rows).toEqual([{
      day_number: 1, start_local: "2026-03-28 23:45:00",
      end_local: "2026-03-29 03:45:00", seconds: 10800,
    }]);
    expect((await db.query("SELECT count(*)::int AS count FROM private.festival_schedule_slot_upsert_receipts")).rows)
      .toEqual([{ count: 1 }]);
  } finally {
    await db.close();
  }
}, 30_000);
