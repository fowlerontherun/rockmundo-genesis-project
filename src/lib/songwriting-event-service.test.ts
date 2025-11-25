import { describe, expect, it, mock } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";

mock.module("@/integrations/supabase/client", () => ({
  supabase: {} as SupabaseClient,
}));

const { persistSongwritingEvent } = await import("./songwriting-event-service");

interface InsertCall {
  table: string;
  payload: Record<string, unknown>;
}

type MockClient = {
  client: SupabaseClient;
  inserts: InsertCall[];
};

const createMockSupabase = (): MockClient => {
  const inserts: InsertCall[] = [];
  let eventCounter = 1;
  let stemCounter = 1;

  const client = {
    from: (table: string) => ({
      insert: (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        const row = Array.isArray(payload) ? payload[0] : payload;
        return {
          select: () => ({
            single: async () => {
              if (table === "songwriting_session_events") {
                return {
                  data: { id: `event-${eventCounter++}`, event_time: row.event_time ?? new Date().toISOString() },
                  error: null,
                };
              }

              if (table === "songwriting_audio_stems") {
                return { data: { id: `stem-${stemCounter++}` }, error: null };
              }

              if (table === "songwriting_section_revisions") {
                return { data: { id: `rev-${stemCounter++}` }, error: null };
              }

              return { data: row, error: null };
            },
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;

  return { client, inserts };
};

describe("persistSongwritingEvent", () => {
  it("persists tempo, chord, lyrics, and instrumentation metadata", async () => {
    const mock = createMockSupabase();

    await persistSongwritingEvent(
      {
        userId: "user-1",
        projectId: "project-1",
        eventType: "lyrics_draft",
        tempoBpm: 128,
        chordProgression: "I-V-vi-IV",
        lyricsDraft: "Hook line",
        instrumentation: ["Guitar", "Synth"],
        mood: "Playful",
        genre: "Pop",
        referenceTracks: ["Band - Hit", " Artist - Ballad "],
      },
      mock.client,
    );

    const eventInsert = mock.inserts.find((entry) => entry.table === "songwriting_session_events");
    expect(eventInsert).toBeTruthy();
    expect(eventInsert?.payload.tempo_bpm).toBe(128);
    expect(eventInsert?.payload.chord_progression).toBe("I-V-vi-IV");
    expect(eventInsert?.payload.instrumentation).toEqual(["Guitar", "Synth"]);
    expect(eventInsert?.payload.reference_tracks).toEqual(["Band - Hit", "Artist - Ballad"]);
  });

  it("links audio stems and revisions when attachments are provided", async () => {
    const mock = createMockSupabase();

    await persistSongwritingEvent(
      {
        userId: "user-1",
        projectId: "project-7",
        eventType: "recording_take",
        audioAttachment: {
          sectionName: "Chorus",
          storagePath: "stems/chorus.wav",
          durationSeconds: 42,
        },
        sectionRevision: {
          lyricsDraft: "Updated chorus",
          takeNumber: 3,
        },
      },
      mock.client,
    );

    const eventInsert = mock.inserts.find((entry) => entry.table === "songwriting_session_events");
    const stemInsert = mock.inserts.find((entry) => entry.table === "songwriting_audio_stems");
    const revisionInsert = mock.inserts.find((entry) => entry.table === "songwriting_section_revisions");

    expect(eventInsert).toBeTruthy();
    expect(stemInsert).toBeTruthy();
    expect(revisionInsert).toBeTruthy();

    expect(stemInsert?.payload.session_event_id).toBe("event-1");
    expect(revisionInsert?.payload.audio_stem_id).toBe("stem-1");
    expect(revisionInsert?.payload.take_number).toBe(3);
  });

  it("sanitizes instrumentation lists by dropping empty values", async () => {
    const mock = createMockSupabase();

    await persistSongwritingEvent(
      {
        userId: "user-9",
        projectId: "project-9",
        eventType: "instrumentation",
        instrumentation: [" Lead Guitar ", "", "Synth"],
      },
      mock.client,
    );

    const eventInsert = mock.inserts.find((entry) => entry.table === "songwriting_session_events");
    expect(eventInsert?.payload.instrumentation).toEqual(["Lead Guitar", "Synth"]);
  });
});
