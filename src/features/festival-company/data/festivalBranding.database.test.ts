// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const company = "22222222-2222-4222-8222-222222222222";
const edition = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const save = (version = 0, theme = "forest", motif = "sunburst") => db.query(
  "select public.save_festival_edition_branding($1::uuid,$2::uuid,$3::integer,$4::text,$5::text) as result", [company, edition, version, theme, motif]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;
    create function public._caller_profile_id() returns uuid language sql as $$ select auth.uid() $$;
    create function public._festival_company_manager_authorized(uuid,uuid) returns boolean language sql as $$ select coalesce(current_setting('test.allowed',true),'yes')='yes' $$;
    create table public.festival_editions_v2(id uuid primary key,festival_company_id uuid,status text,locked_at timestamptz,configuration_locked_at timestamptz,version integer,updated_at timestamptz);
    create table public.festival_edition_audit(festival_company_id uuid,festival_edition_id uuid,actor_profile_id uuid,event_type text,previous_version integer,new_version integer,metadata jsonb);
    create function public.save_festival_edition_annual_plan(uuid,uuid,integer,jsonb,uuid) returns jsonb language plpgsql as $$ begin update public.festival_editions_v2 set version=version+1 where id=$2; return jsonb_build_object('version',$3+1); end $$;
  `);
  for (const path of [
    "supabase/migrations/20261120135123_1d2d6dbd-f2dd-497f-bfac-69522f8a1249.sql",
    "supabase/migrations/20261120135149_ad1eab68-a7b6-4cfc-8ac2-999cc3329bc5.sql",
  ]) await db.exec(readFileSync(path,"utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec(`truncate public.festival_editions_v2,public.festival_edition_audit; set test.allowed='yes'; insert into public.festival_editions_v2(id,festival_company_id,status,version) values('${edition}','${company}','draft',3);`);
});
afterAll(async () => { await db?.close(); });

describe("protected edition branding", () => {
  it("persists cosmetics and one audit without changing the gameplay version", async () => {
    await save(); await save();
    const result = await db.query("select brand_theme,brand_motif,branding_version,version from public.festival_editions_v2");
    expect(result.rows).toEqual([{brand_theme:"forest",brand_motif:"sunburst",branding_version:1,version:3}]);
    expect((await db.query("select count(*)::integer as count from public.festival_edition_audit")).rows).toEqual([{count:1}]);
  });
  it("rejects a non-manager", async () => {
    await db.exec("set test.allowed='no'");
    await expect(save()).rejects.toThrow("festival_branding_forbidden");
  });
  it("rejects a stale edit rather than overwriting another theme", async () => {
    await save(); await expect(save(0,"indie")).rejects.toThrow("festival_branding_stale");
  });
  it.each(["completed","cancelled"])("keeps %s editions frozen", async status => {
    await db.query("update public.festival_editions_v2 set status=$1",[status]);
    await expect(save()).rejects.toThrow("festival_branding_locked");
  });
  it.each(["locked_at","configuration_locked_at"])("respects %s", async column => {
    await db.exec(`update public.festival_editions_v2 set ${column}=now()`);
    await expect(save()).rejects.toThrow("festival_branding_locked");
  });
  it("rejects unknown motifs", async () => {
    await expect(save(0,"forest","invalid")).rejects.toThrow("festival_branding_invalid");
  });
  it("rolls the plan back when branding is invalid", async () => {
    await expect(db.query(`select public.save_festival_edition_wizard('${company}','${edition}',3,'{}','11111111-1111-4111-8111-111111111111','{"theme":"invalid","motif":"spotlight","version":0}')`)).rejects.toThrow("festival_branding_invalid");
    expect((await db.query("select version from public.festival_editions_v2")).rows).toEqual([{version:3}]);
  });
  it("exposes only cosmetic keys through a non-elevated public reader", async () => {
    expect((await db.query(`select public.get_festival_edition_branding('${edition}') as result`)).rows).toEqual([{ result: { theme:null,motif:"spotlight",version:0 } }]);
    expect((await db.query("select prosecdef from pg_proc where oid='public.get_festival_edition_branding(uuid)'::regprocedure")).rows).toEqual([{prosecdef:false}]);
    expect((await db.query("select has_function_privilege('anon','private.save_festival_edition_branding(uuid,uuid,integer,text,text)','EXECUTE') as allowed")).rows).toEqual([{allowed:false}]);
  });
});