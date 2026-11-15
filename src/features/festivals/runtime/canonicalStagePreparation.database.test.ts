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
      CREATE TABLE festival_runtime_configuration_versions(runtime_id uuid,edition_id uuid,rules_version text,configuration jsonb);
      ALTER TABLE festival_edition_runtimes ADD COLUMN gate_status text, ADD COLUMN last_action text,
        ADD COLUMN simulated_time timestamptz, ADD COLUMN completed_at timestamptz,
        ADD COLUMN admitted integer, ADD COLUMN departed integer,
        ADD COLUMN admitted_attendance integer DEFAULT 0, ADD COLUMN departed_attendance integer DEFAULT 0,
        ADD COLUMN expected_attendance integer DEFAULT 1000;
      CREATE TABLE festival_runtime_action_audit(runtime_id uuid,actor_profile_id uuid,
        action text,previous_state text,new_state text,metadata jsonb);
      CREATE SCHEMA extensions;
      CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql AS
        'SELECT sha256(convert_to($1,''UTF8''))';
      CREATE FUNCTION public._festival_edition_runtime_authorised(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql AS
        'SELECT EXISTS(SELECT 1 FROM public.festival_companies WHERE id=$1 AND owner_profile_id=$3)';
      CREATE FUNCTION public._festival_runtime_projection(uuid,uuid) RETURNS jsonb LANGUAGE sql AS
        'SELECT jsonb_build_object(''version'',version) FROM public.festival_edition_runtimes WHERE id=$1';
      CREATE TABLE festival_site_plans(id uuid PRIMARY KEY, festival_edition_id uuid, festival_company_id uuid);
      CREATE TABLE festival_site_plan_stages(id uuid PRIMARY KEY, festival_site_plan_id uuid,
        status text, name text, sort_order integer, capacity integer);
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
    await db.exec(baseline.slice(baseline.indexOf("CREATE SCHEMA"), baseline.indexOf("-- REVIEW ONLY. Depends on canonical_edition_stage_evidence_ledger.sql.")));
    await db.exec(baseline.slice(baseline.indexOf("CREATE TABLE IF NOT EXISTS private.festival_edition_stage_action_receipts"), baseline.indexOf("CREATE OR REPLACE FUNCTION public.record_canonical_festival_stage_action")));
    await db.exec(baseline.slice(baseline.indexOf("CREATE TABLE private.festival_live_day_receipts"),
      baseline.indexOf("CREATE FUNCTION public.advance_canonical_festival_live_day")));
    await db.exec(patch);
    await db.exec(`
      INSERT INTO cities VALUES ('${id(1)}','Europe/London');
      INSERT INTO festival_companies VALUES ('${id(2)}','${id(11)}');
      INSERT INTO festival_editions_v2 VALUES ('${id(3)}','${id(2)}','${id(1)}',
        (now() AT TIME ZONE 'Europe/London')::date,(now() AT TIME ZONE 'Europe/London')::date,'live');
      INSERT INTO festival_site_plans VALUES ('${id(4)}','${id(3)}','${id(2)}');
      INSERT INTO festival_site_plan_stages VALUES ('${id(5)}','${id(4)}','ready','Main Stage',1,100);
      INSERT INTO festival_edition_runtimes(id,edition_id,festival_company_id,state,version,generated_schedule)
      VALUES ('${id(6)}','${id(3)}','${id(2)}','live',1,
        jsonb_build_object('timezone','Europe/London','items',(
          SELECT jsonb_agg(jsonb_build_object('id',act.id,'stageId','${id(5)}',
            'festivalDate',(now() AT TIME ZONE 'Europe/London')::date,'artistName',act.name))
          FROM (VALUES ('${id(7)}','Headliner'),('${id(8)}','Support')) AS act(id,name)
        )));
      UPDATE festival_edition_runtimes SET site_capacity=500,site_attendance=0;
      INSERT INTO festival_runtime_configuration_versions
      SELECT '${id(6)}',id,'canonical-live-day-v1',jsonb_build_object(
        'timezone','Europe/London','startsOn',starts_on,'endsOn',ends_on,
        'generatedSchedule',jsonb_build_object('stages',jsonb_build_array(jsonb_build_object('id','${id(5)}','capacity',100))))
      FROM festival_editions_v2;
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
    const crowd = async () => (await db.query<{ crowds: unknown[] }>(
      "SELECT get_public_festival_edition_live_status('fixture')->'stageCrowds' AS crowds",
    )).rows[0].crowds;
    const tick = (otherZones = 30, requestId = id(21)) => db.query<{ result: unknown }>(
      "SELECT advance_canonical_festival_live_day($1,1,$2,'tick',100,0,$3,$4) AS result",
      [id(6), requestId, { [id(5)]: 70 }, otherZones],
    );
    await expect(tick(29)).rejects.toThrow("festival_live_attendance_not_conserved");
    expect(await crowd()).toEqual([]);
    // A stage-capacity change after the runtime froze its schedule makes the
    // capture trigger reject the tick after the runtime and evidence writes.
    await db.exec("RESET ROLE; UPDATE festival_site_plan_stages SET capacity=60; SET ROLE authenticated");
    await expect(tick()).rejects.toThrow("festival_stage_allocation_capacity_invalid");
    expect(await crowd()).toEqual([]);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT version,site_attendance FROM festival_edition_runtimes")).rows)
      .toEqual([{ version: 1, site_attendance: 0 }]);
    expect((await db.query("SELECT count(*)::int AS count FROM festival_runtime_evidence WHERE evidence_type='live_day_tick'")).rows)
      .toEqual([{ count: 0 }]);
    await db.exec("UPDATE festival_site_plan_stages SET capacity=100; SET ROLE authenticated");
    expect((await tick()).rows[0].result).toMatchObject({ version: 2 });
    expect((await tick()).rows[0].result).toMatchObject({ version: 2 });
    await expect(tick(29)).rejects.toThrow("festival_live_request_conflict");
    expect(await crowd()).toEqual([{
      stageId: id(5), stageName: "Main Stage", festivalDate: expect.any(String),
      lastCalculatedAt: expect.any(String), crowdBand: "very_busy", mood: null,
    }]);
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT count(*)::int AS count FROM private.festival_edition_stage_crowd_observations")).rows)
      .toEqual([{ count: 1 }]);
    expect((await db.query("SELECT count(*)::int AS count FROM private.festival_edition_stage_events")).rows)
      .toEqual([{ count: 6 }]);
    await db.exec("UPDATE festival_edition_runtimes SET state='paused'; SET ROLE anon");
    expect(await publicStates()).toEqual([]);
    expect(await crowd()).toEqual([]);
    await db.exec(`
      RESET ROLE;
      INSERT INTO festival_edition_runtimes(id,edition_id,festival_company_id,state,version,generated_schedule,created_at)
      SELECT '${id(22)}',edition_id,festival_company_id,'live',1,generated_schedule,created_at+interval '1 second'
      FROM festival_edition_runtimes WHERE id='${id(6)}';
      SET ROLE anon;
    `);
    expect(await publicStates()).toEqual([]);
    expect(await crowd()).toEqual([]);
  } finally {
    await db.close();
  }
}, 30_000);
