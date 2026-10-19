import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261019095000_secure_music_video_generation_attempts.sql", "utf8");
const harness = readFileSync("supabase/tests/music_video_atomic_generation_4240.sql", "utf8");
const callback = readFileSync("supabase/functions/music-video-callback/index.ts", "utf8");
const generator = readFileSync("supabase/functions/generate-music-video/index.ts", "utf8");
const dialog = readFileSync("src/components/music-video/VipVideoCreationDialog.tsx", "utf8");

describe("music-video webhook settlement authority (#4240)", () => {
  it("requires HMAC, timestamp and exact provider prediction before privileged access", () => {
    expect(callback).toContain('verifyReplicateWebhookSignature');
    expect(callback).toContain('req.headers.get("webhook-id")');
    expect(callback).toContain('req.headers.get("webhook-timestamp")');
    expect(callback).toContain('req.headers.get("webhook-signature")');
    expect(callback).toContain('await signedByReplicate(req, rawBody)');
    expect(callback.indexOf('await signedByReplicate(req, rawBody)')).toBeLessThan(callback.indexOf('const supabase = createClient('));
    expect(callback).toContain('attempt.prediction_id !== payload.id');
    expect(callback).toContain('"settle_music_video_generation"');
    expect(callback).not.toContain("cash: (profile.cash || 0) + 75000");
    expect(callback).not.toContain('.from("profiles").update');
  });

  it("charges only a verified VIP active character with exact video/song ownership", () => {
    expect(sql).toContain('public.current_active_player_profile_id()');
    expect(sql).toContain("v_profile.is_vip");
    expect(sql).toContain("v_song.user_id=v_user");
    expect(sql).toContain("VIDEO_SONG_NOT_OWNED");
    expect(sql).toContain("v_profile.cash<75000");
    expect(sql).toContain("SET cash=cash-75000");
    expect(sql).toContain("v_prior.profile_id<>v_profile.id");
    expect(sql).toContain("charge_amount bigint NOT NULL CHECK (charge_amount=75000)");
    expect(dialog).toContain('.rpc("reserve_music_video_generation"');
    expect(dialog).not.toContain('.update({ cash: profile.cash - VIP_VIDEO_COST })');
    expect(dialog).not.toContain('.from("music_videos")\n        .insert(');
  });

  it("cannot pay for two jobs from one reservation or credit a duplicate failure", () => {
    expect(sql).toContain('state=\'preparing\'');
    expect(sql).toContain("VIDEO_RESERVATION_NOT_AVAILABLE");
    expect(sql).toContain("prediction_id text UNIQUE");
    expect(sql).toContain("WHERE video_id=p_video_id FOR UPDATE");
    expect(sql).toContain("VIDEO_PREDICTION_MISMATCH");
    expect(sql).toContain("v_attempt.state IN ('failed','succeeded')");
    expect(sql).toContain("cash=cash+v_attempt.charge_amount");
    expect(sql).toContain("VIDEO_UNREGISTERED_SETTLEMENT");
    expect(sql).toContain("expire_stale_music_video_preparations");
    expect(sql).toContain("expire-unstarted-music-video-generations");
    expect(generator).toContain('"claim_music_video_generation"');
    expect(generator).toContain('"register_music_video_prediction"');
    expect(generator).toContain("claimedVideoId && !registered");
  });

  it("ships a nonmutating live integration harness for malicious callbacks and double refunds", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    for (const assertion of [
      "reservation_idempotent", "generation_claimed_once", "provider_registered",
      "failure_refunded", "duplicate_failure_ignored", "prior_failure_cannot_succeed",
      "success_settled", "late_failure_cannot_refund_success", "preflight_refunded",
      "stale_refunded", "only_success_charged", "browser_refund_denied",
    ]) expect(harness).toContain(assertion);
  });
});
