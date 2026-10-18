import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const webhook = read("supabase/functions/replicate-webhook/index.ts");
const migration = read("supabase/migrations/20261018084500_ai_audio_weekly_limit_8.sql");

describe("AI song minimum duration and weekly allowance", () => {
  it("accepts every complete MP3 at or above 60 seconds without a maximum duration", () => {
    expect(webhook).toContain("const minSeconds = 60");
    expect(webhook).toContain("if (actualSeconds < minSeconds)");
    expect(webhook).toContain("const acceptedAudioBytes = audioBytes");
    expect(webhook).not.toContain("const maxSeconds = 90");
    expect(webhook).not.toContain("clipLongMp3ToSeconds(");
    expect(webhook).not.toContain("actualSeconds > maxSeconds");
  });

  it("still validates file integrity and saves short paid outputs as failed previews", () => {
    expect(webhook).toContain("getMp3DurationSeconds(audioBytes)");
    expect(webhook).toContain("if (actualSeconds === null)");
    expect(webhook).toContain("Preview stored:");
    expect(webhook).toContain("manual retry only.");
    expect(webhook).toContain(".upload(filename, acceptedAudioBytes");
  });

  it("updates both preflight and atomic quota checks from five to eight", () => {
    expect(migration).toContain("public.check_song_generation_limit(uuid)");
    expect(migration).toContain("public.reserve_song_generation_atomic(uuid,uuid,boolean,uuid,boolean)");
    expect(migration).toContain("v_limit INTEGER := 8;");
    expect(migration).toContain("v_limit integer := 8;");
  });
});
