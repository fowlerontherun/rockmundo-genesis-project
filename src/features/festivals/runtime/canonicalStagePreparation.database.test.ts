// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const baseline = readFileSync("supabase/migrations/20261114175725_canonical_festival_live_day.sql", "utf8");
const patch = readFileSync("supabase/migrations/20261115210144_canonical_festival_stage_preparation.sql", "utf8");

it("publishes only authorised canonical preparation and performance transitions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      CREATE TYPE public.app_role AS ENUM ('admin');
      CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS 'SELECT false';
      CREATE FUNCTION public._caller_profile_id() RETURNS uuid LANGUAGE sql AS 'SELECT auth.uid()';
      CREATE TABLE cities(id uuid PRIMARY KEY, timezone text);
      CREATE TABLE festival_companies(id uuid PRIMARY KEY, owner_profile_id uuid);
      CREATE TABLE festival_editions_v2(id uuid PRIMARY KEY, festival_company_id uuid, city_id uuid,
        starts_on date, ends_on date, status text);
      CREATE TABLE festival_edition_runtimes(id uuid PRIMARY KEY, edition_id uuid, festival_company_id uuid,
        state text, version integer, generated_schedule jsonb, created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(), site_capacity integer, site_attendance integer, weather_sequence jsonb);
      CREATE TABLE festival_runtime_configuration_versions(id uuid PRIMARY KEY);
      CREATE TABLE festival_site_plans(id uuid PRIMARY KEY, festival_edition_id uuid, festival_company_id uuid);
      CREATE TABLE festival_site_plan_stages(id uuid PRIMARY KEY, festival_site_plan_id uuid,
        status text, name text, sort_order integer);
      CREATE TABLE festival_runtime_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), runtime_id uuid,
        evidence_type text, evidence jsonb, evidence_digest text, created_at timestamptz DEFAULT clock_timestamp(),
        UNIQUE(runtime_id,evidence_type));
      CREATE TABLE festival_artist_programmes(id uuid, festival_edition_id uuid);
      CREATE TABLE festival_artist_bookings(id uuid, festival_artist_programme_id uuid, status text, band_id uuid);
      CREATE TABLE festival_launches(id uuid, festival_company_id uuid, public_slug text, public_visibility text, launch_status text);
      CREATE TABLE festival_public_profiles(festival_company_id uuid, public_slug text);
      CREATE FUNCTION public.festival_public_projection_v2(uuid) RETURNS jsonb LANGUAGE sql AS
        'SELECT jsonb_build_object(''id'',''${id(9)}'',''editionId'',''${id(3)}'')';
    `);
    await db.exec(baseline.slice(baseline.indexOf("CREATE SCHEMA"), baseline.indexOf("CREATE OR REPLACE FUNCTION private.capture_canonical_festival_stage_audience_allocation")));
    await db.exec(baseline.slice(baseline.indexOf("CREATE TABLE IF NOT EXISTS private.festival_edition_stage_action_receipts"), baseline.indexOf("CREATE OR REPLACE FUNCTION public.record_canonical_festival_stage_action")));
    await db.exec(patch);
    await db.exec(`
      INSERT INTO cities VALUES ('${id(1)}','Europe/London');
      INSERT INTO festival_companies VALUES ('${id(2)}','${id(11)}');
      INSERT INTO festival_editions_v2 VALUES ('${id(3)}','${id(2)}','${id(1)}',
        (now() AT TIME ZONE 'Europe/London')::date,(now() AT TIME ZONE 'Europe/London')::date,'live');
      INSERT INTO festival_site_plans VALUES ('${id(4)}','${id(3)}','${id(2)}');
      INSERT INTO festival_site_plan_stages VALUES ('${id(5)}','${id(4)}','ready','Main Stage',1);
      INSERT INTO festival_edition_runtimes(id,edition_id,festival_company_id,state,version,generated_schedule)
      VALUES ('${id(6)}','${id(3)}','${id(2)}','live',1,
        jsonb_build_object('timezone','Europe/London','items',(
          SELECT jsonb_agg(jsonb_build_object('id',act.id,'stageId','${id(5)}',
            'festivalDate',(now() AT TIME ZONE 'Europe/London')::date,'artistName',act.name))
          FROM (VALUES ('${id(7)}','Headliner'),('${id(8)}','Support')) AS act(id,name)
        )));
      INSERT INTO festival_launches VALUES ('${id(9)}','${id(2)}','fixture','public','launched');
    `);
    const action = (status: string, item = id(7), key = `fixture:${item}:${status}`) => db.query<{ result: unknown }>(
      "SELECT record_canonical_festival_stage_action($1,$2,$3,$4,$5,1) AS result",
      [id(6), id(5), item, status, key],
    );
    const publicStates = async () => (await db.query<{ performances: unknown[] }>(
      "SELECT get_public_festival_edition_live_status('fixture')->'performances' AS performances",
    )).rows[0].performances;

    await db.exec("SET ROLE anon");
    expect(await publicStates()).toEqual([]);
    await expect(action("soundcheck")).rejects.toThrow("permission denied");
    await db.exec("SET ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(12)]);
    await expect(action("soundcheck")).rejects.toThrow("festival_stage_action_forbidden");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(11)]);
    await expect(action("live")).rejects.toThrow("festival_stage_missing_initial_state");
    for (const status of ["changeover", "soundcheck", "starting", "live", "delayed", "cancelled"]) {
      expect((await action(status)).rows[0].result).toMatchObject({ status, replayed: false });
      expect(await publicStates()).toMatchObject([{ status, stageId: id(5), artistName: "Headliner" }]);
      if (status === "soundcheck") {
        await expect(action("soundcheck", id(8))).rejects.toThrow("festival_stage_overlap_not_permitted");
        await expect(action("completed")).rejects.toThrow("festival_stage_invalid_event_transition");
        expect((await action(status)).rows[0].result).toMatchObject({ replayed: true });
      }
    }
    await expect(action("starting", id(7), "fixture:after-cancellation")).rejects.toThrow("festival_stage_invalid_event_transition");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT count(*)::int AS count FROM private.festival_edition_stage_events")).rows)
      .toEqual([{ count: 6 }]);
    await db.exec("UPDATE festival_edition_runtimes SET state='paused'; SET ROLE anon");
    expect(await publicStates()).toEqual([]);
  } finally {
    await db.close();
  }
}, 30_000);
