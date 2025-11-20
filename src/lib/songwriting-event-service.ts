import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import logger from "@/lib/logger";

export const SONGWRITING_EVENT_TYPES = [
  "tempo_change",
  "chord_progression",
  "lyrics_draft",
  "instrumentation",
  "recording_take",
  "manual_annotation",
] as const;

export type SongwritingEventType = (typeof SONGWRITING_EVENT_TYPES)[number];

export interface SongwritingEventInput {
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  songId?: string | null;
  eventType: SongwritingEventType;
  eventTime?: string;
  tempoBpm?: number | null;
  chordProgression?: string | null;
  lyricsDraft?: string | null;
  instrumentation?: string[];
  takeNumber?: number | null;
  mood?: string | null;
  genre?: string | null;
  referenceTracks?: string[];
  metadata?: Record<string, unknown>;
  audioAttachment?: {
    sectionName: string;
    storagePath: string;
    durationSeconds?: number | null;
    recordedAt?: string | null;
    notes?: string | null;
  } | null;
  sectionRevision?: {
    sectionName?: string | null;
    lyricsDraft?: string | null;
    chordProgression?: string | null;
    tempoBpm?: number | null;
    instrumentation?: string[];
    takeNumber?: number | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
}

export interface PersistSongwritingEventResult {
  eventId: string;
  audioStemId: string | null;
}

const sanitizeArray = (values?: string[] | null) => {
  if (!Array.isArray(values)) return null;
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered : null;
};

export const persistSongwritingEvent = async (
  input: SongwritingEventInput,
  client: SupabaseClient = supabase as SupabaseClient,
): Promise<PersistSongwritingEventResult> => {
  const {
    userId,
    projectId = null,
    sessionId = null,
    songId = null,
    eventType,
    eventTime,
    tempoBpm,
    chordProgression,
    lyricsDraft,
    instrumentation,
    takeNumber,
    mood,
    genre,
    referenceTracks,
    metadata,
    audioAttachment,
    sectionRevision,
  } = input;

  if (!userId) {
    throw new Error("User ID is required to log songwriting events");
  }

  const instrumentationArray = sanitizeArray(instrumentation ?? null);
  const referenceArray = sanitizeArray(referenceTracks ?? null);

  const eventRecord = {
    project_id: projectId,
    session_id: sessionId,
    song_id: songId,
    user_id: userId,
    event_type: eventType,
    event_time: eventTime ?? new Date().toISOString(),
    tempo_bpm: typeof tempoBpm === "number" ? tempoBpm : null,
    chord_progression: chordProgression ?? null,
    lyrics_draft: lyricsDraft ?? null,
    instrumentation: instrumentationArray,
    take_number: typeof takeNumber === "number" ? takeNumber : null,
    mood: mood ?? null,
    genre: genre ?? null,
    reference_tracks: referenceArray,
    metadata: metadata ?? {},
  };

  const { data: event, error: eventError } = await client
    .from("songwriting_session_events")
    .insert(eventRecord)
    .select()
    .single();

  if (eventError || !event) {
    logger.error("Failed to persist songwriting event", { error: eventError, eventType });
    throw eventError ?? new Error("Failed to create songwriting event");
  }

  let audioStemId: string | null = null;

  if (audioAttachment) {
    if (!projectId) {
      throw new Error("Audio attachments require a project ID");
    }

    const { data: stem, error: stemError } = await client
      .from("songwriting_audio_stems")
      .insert({
        project_id: projectId,
        session_event_id: event.id,
        section_name: audioAttachment.sectionName,
        storage_path: audioAttachment.storagePath,
        duration_seconds: audioAttachment.durationSeconds ?? null,
        recorded_at: audioAttachment.recordedAt ?? event.event_time,
        created_by: userId,
        notes: audioAttachment.notes ?? null,
      })
      .select()
      .single();

    if (stemError || !stem) {
      logger.error("Failed to create songwriting audio stem", { error: stemError });
      throw stemError ?? new Error("Failed to create audio stem");
    }

    audioStemId = stem.id;

    if (sectionRevision) {
      const { error: revisionError } = await client
        .from("songwriting_section_revisions")
        .insert({
          project_id: projectId,
          audio_stem_id: stem.id,
          section_name: sectionRevision.sectionName ?? audioAttachment.sectionName,
          lyrics_draft: sectionRevision.lyricsDraft ?? lyricsDraft ?? null,
          chord_progression: sectionRevision.chordProgression ?? chordProgression ?? null,
          tempo_bpm: typeof sectionRevision.tempoBpm === "number" ? sectionRevision.tempoBpm : tempoBpm ?? null,
          instrumentation: sanitizeArray(sectionRevision.instrumentation ?? instrumentationArray ?? undefined),
          take_number: typeof sectionRevision.takeNumber === "number" ? sectionRevision.takeNumber : takeNumber ?? null,
          revision_notes: sectionRevision.notes ?? null,
          metadata: sectionRevision.metadata ?? metadata ?? {},
          created_by: userId,
        })
        .select()
        .single();

      if (revisionError) {
        logger.error("Failed to create songwriting section revision", { error: revisionError });
        throw revisionError;
      }
    }
  }

  return { eventId: event.id, audioStemId };
};

