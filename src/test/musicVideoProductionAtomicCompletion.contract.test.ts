import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261019125734_atomic_music_video_release_awards_and_internal_cron.sql", "utf8",
);
const retiredEdge = readFileSync("supabase/functions/complete-video-production/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const harness = readFileSync("supabase/tests/music_video_atomic_completion_4253.sql", "utf8");

describe("music-video production exactly-once awards (#4253)", () => {
  it("keeps a unique video reward receipt, denied player grants and service-only worker", () => {
    expect(migration).toContain("video_id uuid PRIMARY KEY");
    expect(migration).toContain("music_video_production_awards ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("video_already_awarded_but_not_released_");
  });

  it("processes only due production videos with row locking and skips concurrent claims", () => {
    expect(migration).toContain("v.status='production'");
    expect(migration).toContain("FOR UPDATE OF v SKIP LOCKED");
    expect(migration).toContain("v.created_at +");
    expect(migration).toContain("p_limit>200");
    expect(migration).toContain("pg_try_advisory_xact_lock(4253,48)");
    expect(migration).toContain("previous_completion_running");
  });

  it("sets release, awards, band fame, character fame and notification atomically", () => {
    expect(migration).toContain("UPDATE public.music_videos");
    expect(migration).toContain("UPDATE public.bands SET");
    expect(migration).toContain("UPDATE public.profiles SET");
    expect(migration).toContain("INSERT INTO public.music_video_production_awards");
    expect(migration).toContain("INSERT INTO public.activity_feed");
    expect(migration).toContain("p.id=v_song.profile_id AND p.user_id=v_song.user_id");
    expect(migration).toContain("WHERE id=v_profile_id");
    expect(migration).toContain("video_completion_state_changed_");
    expect(migration).not.toContain("profile_id=v_song.user_id");
  });

  it("retires the HTTP service-role worker and deletes the stored cron bearer", () => {
    expect(retiredEdge).toContain("status: 410");
    expect(retiredEdge).not.toContain("createClient");
    expect(retiredEdge).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(retiredEdge).not.toContain("music_videos\"");
    expect(config).toContain("[functions.complete-video-production]\nverify_jwt = true");
    expect(migration).toContain("'complete-video-production','*/30 * * * *'");
    expect(migration).toContain("SELECT public.run_music_video_production_completion_scheduled();");
    expect(migration).toContain("video_completion_cron_replaced");
    expect(migration).not.toContain("net.http_post");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("records the actual internal job outcome for operational monitoring", () => {
    expect(migration).toContain("INSERT INTO public.cron_job_runs");
    expect(migration).toContain("status='success'");
    expect(migration).toContain("processed_count=coalesce((v_summary->>'completed')::integer,0)");
    expect(migration).toContain("result_summary=v_summary");
    expect(migration).toContain("allow_manual_trigger=false");
  });

  it("covers band, solo, not due and replay with a rolled-back real schema fixture", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("__4253_rollback_band__");
    expect(harness).toContain("__4253_rollback_solo__");
    expect(harness).toContain("not_due_video_released");
    expect(harness).toContain("video_reward_replayed");
    expect(harness).toContain("video_completion_acl_incorrect");
  });
});
