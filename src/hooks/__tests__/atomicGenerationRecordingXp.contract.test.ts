import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const sql = read("supabase/migrations/20261015090000_atomic_ai_generation_and_recording_xp.sql");
const generate = read("supabase/functions/generate-song-audio/index.ts");
const admin = read("supabase/functions/admin-generate-song-audio/index.ts");
const webhook = read("supabase/functions/replicate-webhook/index.ts");
const recording = read("supabase/functions/complete-recording-sessions/index.ts");

describe("five-issue studio generation and XP authority contracts", () => {
  it("#4120 enforces at most one active paid prediction per song across routes", () => {
    expect(sql).toContain("song_generation_single_active_per_song");
    expect(sql).toContain("WHERE status = 'generating'");
    expect(sql).toContain("FROM public.songs WHERE id=p_song_id FOR UPDATE");
    expect(generate).toContain("'reserve_song_generation_atomic'");
    expect(admin).toContain('"reserve_song_generation_atomic"');
    expect(generate).not.toContain(".from('song_generation_attempts')\n      .insert");
    expect(admin).not.toContain('.from("song_generation_attempts")\n      .insert');
  });

  it("#4121 reserves quota serially for different songs belonging to one user", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0))");
    expect(sql).toContain("status IN ('generating','completed')");
    expect(sql).toContain("'WEEKLY_GENERATION_LIMIT'");
    expect(generate).toContain("code === 'WEEKLY_GENERATION_LIMIT' ? 429 : 409");
    expect(sql).toContain("p_admin_override boolean DEFAULT false");
  });

  it("#4122 finalizes song and attempt transactionally and rejects stale callbacks", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.finish_song_generation_atomic");
    expect(sql).toContain("v_attempt.id<>p_attempt_id OR v_attempt.status<>'generating'");
    expect(sql).toContain("SET status=p_status, completed_at=now()");
    expect(sql).toContain("audio_url=CASE WHEN p_status='completed' THEN p_audio_url ELSE audio_url END");
    expect(webhook).toContain("p_status: 'completed'");
    expect(webhook).toContain("if (!finalization?.applied)");
    expect(webhook).not.toContain(".from('songs')\n      .update({\n        audio_url: audioUrl,");
  });

  it("#4108 stops recording completion on any failed XP transaction", () => {
    expect(recording).toContain(".rpc('award_recording_xp_atomic', { p_session_id: session.id })");
    expect(recording).toContain("if (awardError) throw new Error");
    expect(recording).toContain("recording_xp_award_missing_confirmation");
    expect(recording).not.toContain("action: 'award_action_xp'");
    expect(sql).toContain("RECORDING_XP_WALLET_MISSING");
  });

  it("#4117 grants each outcome profile/skill exactly once without user-defined amounts", () => {
    expect(sql).toContain("jsonb_array_elements(v_session.xp_awards)");
    expect(sql).toContain("PRIMARY KEY(session_id,profile_id,skill_slug)");
    expect(sql).toContain("ON CONFLICT(session_id,profile_id,skill_slug) DO NOTHING");
    expect(sql).toContain("skill_xp_balance=coalesce(skill_xp_balance,0)+v_award.amount");
    expect(sql).toContain("'recording_complete',v_award.skill_slug,v_award.amount");
    expect(recording).toContain("producerCharacterId");
    expect(recording).toContain("const performerProfileId = member.profile_id");
  });

  it("restricts all privileged RPCs to the service role", () => {
    for (const name of [
      "reserve_song_generation_atomic", "finish_song_generation_atomic", "award_recording_xp_atomic",
    ]) {
      expect(sql).toContain("public." + name);
    }
    expect((sql.match(/SERVICE_ROLE_REQUIRED/g) ?? []).length).toBe(3);
    expect((sql.match(/GRANT EXECUTE ON FUNCTION public\./g) ?? []).length).toBe(3);
    expect((sql.match(/TO service_role;/g) ?? []).length).toBe(3);
  });
});
