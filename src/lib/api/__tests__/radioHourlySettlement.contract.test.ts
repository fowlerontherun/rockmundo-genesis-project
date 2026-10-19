import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261019110500_atomic_hourly_radio_rotation.sql", "utf8");
const harness = readFileSync("supabase/tests/radio_hourly_atomic_4242.sql", "utf8");
const edge = readFileSync("supabase/functions/simulate-radio-plays/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("hourly radio airplay job authority (#4242)", () => {
  it("retires the unauthenticated privileged Edge worker", () => {
    expect(edge).toContain("status: 410");
    expect(edge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(edge).not.toContain('.from("bands")');
    expect(edge).not.toContain('.from("radio_plays")');
    expect(config).toMatch(/\[functions\.simulate-radio-plays\]\s*verify_jwt = true/);
  });

  it("cuts the existing hourly cron over to PostgreSQL with no stored JWT", () => {
    expect(migration).toContain("cron.alter_job(v_job");
    expect(migration).toContain("command=>'SELECT public.process_hourly_radio_plays();'");
    expect(migration).not.toContain("net.http_post");
    expect(migration).not.toContain("eyJhbGci");
    expect(migration).toContain("simulate-radio-plays-cron");
  });

  it("settles only one playlist and hour, preserving historical records", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS simulation_hour timestamptz");
    expect(migration).toContain("radio_plays_playlist_hour_unique");
    expect(migration).toContain("WHERE simulation_hour IS NOT NULL");
    expect(migration).toContain("ON CONFLICT (playlist_id,simulation_hour)");
    expect(migration).toContain("FOR UPDATE OF pl SKIP LOCKED");
    expect(migration).toContain("FOR UPDATE;");
    expect(migration).not.toContain(".limit(100)");
    expect(migration).toContain("newest_existing_hour");
  });

  it("credits the source-of-truth song, band and solo character only in one transaction", () => {
    expect(migration).toContain("UPDATE public.songs");
    expect(migration).toContain("UPDATE public.bands");
    expect(migration).toContain("UPDATE public.profiles");
    expect(migration).toContain("WHERE id=v_song.profile_id AND user_id=v_song.user_id");
    expect(migration).toContain("RADIO_SOLO_PROFILE_MISMATCH");
    expect(migration).toContain("INSERT INTO public.band_sentiment_events");
    expect(migration).toContain("public.add_band_country_fame(");
    expect(migration).toContain("v_item.country,v_fame,v_fans,false");
  });

  it("denies anonymous and browser writes to radio play receipts", () => {
    expect(migration).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.radio_plays");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.process_hourly_radio_plays()");
    expect(migration).toContain("TO service_role");
  });

  it("ships a rollback-only live two-run check for the whole playlist catalogue", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    for(const check of [
      "all_playlist_pages_present","complete_hourly_coverage",
      "replay_zero_new_plays","replay_no_extra_song_hype",
      "replay_no_extra_band_fame","replay_no_extra_profile_fame",
      "unique_playlist_hour","internal_cron_command",
      "hourly_schedule_unchanged","no_browser_fake_plays",
    ]) expect(harness).toContain(check);
  });
});
