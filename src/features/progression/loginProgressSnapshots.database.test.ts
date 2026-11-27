// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LoginProgressClaim } from "./loginProgressSummary";

const migration = fs.readFileSync(path.resolve("supabase/migrations/20261127083004_login_progress_snapshots.sql"), "utf8");
const userId = "dfeacaf0-3b4c-4404-8046-aaad2ac2ad21";
const profileId = "725eb5bf-f93d-4843-96e3-8d85632f7491";
const otherProfile = "725eb5bf-f93d-4843-96e3-8d85632f7492";
const firstSession = "4979cdb1-5d1d-46c7-82ed-2e7d574006f1";
const secondSession = "4979cdb1-5d1d-46c7-82ed-2e7d574006f2";

describe("claim_login_progress_summary SQL", () => {
  let db: PGlite;
  const claim = async (): Promise<LoginProgressClaim> => {
    const result = await db.query<{ value: LoginProgressClaim }>(
      "SELECT public.claim_login_progress_summary($1) AS value", [profileId],
    );
    return result.rows[0].value;
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('test.user_id', true), '')::uuid
      $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT jsonb_build_object('session_id', current_setting('test.session_id', true))
      $$;
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY, user_id uuid NOT NULL, level integer NOT NULL DEFAULT 1,
        is_active boolean, died_at timestamptz, deleted_at timestamptz
      );
      CREATE TABLE public.player_xp_wallet (
        profile_id uuid PRIMARY KEY, lifetime_xp integer, skill_xp_lifetime integer
      );
      CREATE TABLE public.skill_progress (
        profile_id uuid, skill_slug varchar, current_level integer, current_xp integer, required_xp integer
      );
    `);
    await db.exec(migration);
    await db.query(
      "INSERT INTO public.profiles (id, user_id, level, is_active) VALUES ($1, $2, 4, true), ($3, $4, 9, true)",
      [profileId, userId, otherProfile, "dfeacaf0-3b4c-4404-8046-aaad2ac2ad22"],
    );
    await db.query("INSERT INTO public.player_xp_wallet VALUES ($1, 400, 450)", [profileId]);
    await db.query("INSERT INTO public.skill_progress VALUES ($1, 'guitar', 3, 80, 200)", [profileId]);
    await db.query("SELECT set_config('test.user_id', $1, false)", [userId]);
    await db.query("SELECT set_config('test.session_id', $1, false)", [firstSession]);
  });
  afterAll(async () => { await db?.close(); });

  it("creates a first-login baseline and returns a recap only once per session", async () => {
    expect(await claim()).toMatchObject({
      show: true, first_login: true, previous: null,
      current: { total_xp: 450, level: 4, skills: { guitar: { level: 3, xp: 80, required: 200 } } },
    });
    expect(await claim()).toEqual({ show: false });
  });
  it("captures differences when the player logs in again", async () => {
    await db.query("UPDATE public.player_xp_wallet SET lifetime_xp = 700, skill_xp_lifetime = 720 WHERE profile_id = $1", [profileId]);
    await db.query("UPDATE public.profiles SET level = 5 WHERE id = $1", [profileId]);
    await db.query("UPDATE public.skill_progress SET current_level = 4, current_xp = 15 WHERE profile_id = $1", [profileId]);
    await db.query("SELECT set_config('test.session_id', $1, false)", [secondSession]);
    expect(await claim()).toMatchObject({
      show: true, first_login: false,
      previous: { total_xp: 450, level: 4, skills: { guitar: { level: 3, xp: 80 } } },
      current: { total_xp: 720, level: 5, skills: { guitar: { level: 4, xp: 15 } } },
    });
    expect(await claim()).toEqual({ show: false });
  });
  it("never lets an older device roll back a newer checkpoint", async () => {
    await db.query("SELECT set_config('test.session_id', $1, false)", [firstSession]);
    expect(await claim()).toEqual({ show: false });
    const count = await db.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM public.player_login_progress_snapshots WHERE profile_id = $1", [profileId],
    );
    expect(count.rows[0].count).toBe("2");
    await db.query("SELECT set_config('test.session_id', $1, false)", [secondSession]);
  });
  it("rejects other players' profiles", async () => {
    await expect(db.query("SELECT public.claim_login_progress_summary($1)", [otherProfile]))
      .rejects.toThrow("character_not_owned_or_inactive");
  });
  it("grants the RPC but not direct table access to authenticated clients", async () => {
    await db.exec("SET ROLE authenticated");
    try {
      await expect(db.query("SELECT * FROM public.player_login_progress_snapshots")).rejects.toThrow("permission denied");
      expect(await claim()).toEqual({ show: false });
    } finally {
      await db.exec("RESET ROLE");
    }
  });
  it("rejects inactive characters", async () => {
    await db.query("UPDATE public.profiles SET is_active = false WHERE id = $1", [profileId]);
    await expect(claim()).rejects.toThrow("character_not_owned_or_inactive");
  });
});
