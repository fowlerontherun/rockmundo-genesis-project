import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("supabase/functions/complete-recording-sessions/index.ts");
const generator = read("supabase/functions/generate-song-audio/index.ts");

describe("AI song generation paid retry protections (#4277)", () => {
  it("does not re-run failed recorded songs on every recording completion cron tick", () => {
    expect(worker).not.toContain("strandedSongs");
    expect(worker).toContain("async function requestInitialSongAudio");
    expect(worker).toContain(".from('song_generation_attempts').select('id')");
    expect(worker).toContain("if (previousAttempts?.length)");
  });

  it("applies first-attempt guard for standard and versioned recording outcomes", () => {
    expect(worker).toContain("requestInitialSongAudio(supabase, targetSongId, versionSongData.user_id)");
    expect(worker).toContain("requestInitialSongAudio(supabase, session.song_id, originalSong.user_id)");
  });

  it("refuses service-role automatic retries, but leaves explicitly requested regeneration available", () => {
    expect(generator).toContain("if (serviceInvocation && !replaceExisting)");
    expect(generator).toContain("AUTOMATIC_RETRY_BLOCKED");
    expect(generator).toContain("if (existingAttempts?.length)");
  });
});
