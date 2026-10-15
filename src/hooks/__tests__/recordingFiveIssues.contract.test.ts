import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = source("supabase/functions/complete-recording-sessions/index.ts");
const audio = source("supabase/functions/generate-song-audio/index.ts");
const booking = source("src/hooks/useRecordingDataAtomic.tsx");
const inbox = source("src/services/finance/atomicBookingClient.ts");
const notifications = source("src/utils/bandActivityScheduling.ts");

describe("recording and AI audio five-issue regression contracts", () => {
  it("#4112 preserves the parent genre and applies acoustic only to the child take", () => {
    expect(worker).toContain("genre: recordingVersion === 'acoustic' ? 'acoustic' : originalSong.genre");
    expect(worker).toContain("...(recordingVersion === 'acoustic' ? { genre: 'acoustic' } : {})");
  });

  it("#4113 checks both child updates and session linkage, including retry recovery", () => {
    expect(worker).toContain("if (lookupError) throw lookupError");
    expect(worker).toContain("if (versionUpdateError) throw versionUpdateError");
    expect(worker).toContain("if (linkError) throw linkError");
    expect(worker).toContain("const parentSongId = originalSong.parent_song_id || session.song_id");
    expect(worker).toContain("if (targetSongId !== session.song_id)");
  });

  it("#4115 authorizes a band song only through an active non-touring character membership", () => {
    expect(audio).toContain("(!ownerSong.band_id && ownerSong.user_id === userId)");
    expect(audio).toContain('member.member_status === "active"');
    expect(audio).toContain("member.is_touring_member !== true");
    expect(audio).toContain("member.profile_id === creatorProfile.id");
  });

  it("#4116 resolves AI vocal gender from the active and living character", () => {
    expect(audio).toContain('.eq("is_active", true)');
    expect(audio).toContain('.is("died_at", null).maybeSingle()');
    expect(audio).toContain("creatorGender: string | null = creatorProfile?.gender || null");
    expect(audio).not.toContain(".select('gender')\n      .eq('user_id', userId)\n      .single()");
  });

  it("#4088 replays failed notifications on retries with deterministic, duplicate-safe IDs", () => {
    expect(booking).toContain("if (booking.idempotent && input.skip_profile_ids?.length)");
    expect(booking).not.toContain("if (!booking.idempotent && input.band_id)");
    expect(booking).not.toContain("else if (!booking.idempotent)");
    expect(inbox).toContain('onConflict: "id"');
    expect(inbox).toContain("ignoreDuplicates: true");
    expect(inbox).toContain("recordingInboxMessageId(sessionId, row.user_id)");
    expect(notifications).toContain("recordingAbsentEventKey(params.linkedRecordingId, conflict.profileId || userId)");
  });
});
