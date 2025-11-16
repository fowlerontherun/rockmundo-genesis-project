#!/usr/bin/env bun
import { createClient } from "@supabase/supabase-js";

import { buildSessionPromptArtifact } from "../src/lib/prompt-engine/sessionPrompts";
import type {
  SessionPromptMetadata,
  StemDescriptor,
} from "../src/lib/prompt-engine/sessionPrompts";
import type { Database, Json } from "../src/lib/supabase-types";

type RecordingSessionRow = Database["public"]["Tables"]["recording_sessions"]["Row"];
type SongRow = Pick<
  Database["public"]["Tables"]["songs"]["Row"],
  | "id"
  | "title"
  | "genre"
  | "lyrics"
  | "lyrics_progress"
  | "arrangement_strength"
  | "melody_strength"
  | "rhythm_strength"
  | "lyrics_strength"
  | "duration_seconds"
  | "music_progress"
  | "quality_score"
>;
type StudioRow = Pick<Database["public"]["Tables"]["city_studios"]["Row"], "id" | "name" | "city_id">;
type ProducerRow = Pick<Database["public"]["Tables"]["recording_producers"]["Row"], "id" | "name">;

type SessionQueryRow = RecordingSessionRow & {
  song: SongRow | null;
  studio: StudioRow | null;
  producer: ProducerRow | null;
};

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
};

const args = parseArgs(process.argv.slice(2));
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? requiredEnv("SUPABASE_URL");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const limit = Number(args.limit ?? process.env.SESSION_PROMPT_LIMIT ?? 10);
const hours = Number(args.hours ?? process.env.SESSION_PROMPT_WINDOW_HOURS ?? 24);
const dryRun = Boolean(args["dry-run"] ?? process.env.SESSION_PROMPT_DRY_RUN);
const stemBucket = process.env.SESSION_STEMS_BUCKET ?? "session-stems";
const promptBucket = process.env.SESSION_PROMPT_BUCKET ?? "session-prompts";

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("recording_sessions")
    .select(
      `
      id,
      song_id,
      studio_id,
      producer_id,
      band_id,
      user_id,
      status,
      recording_version,
      quality_improvement,
      scheduled_start,
      scheduled_end,
      duration_hours,
      total_cost,
      updated_at,
      song:songs!recording_sessions_song_id_fkey (
        id,
        title,
        genre,
        lyrics,
        lyrics_progress,
        arrangement_strength,
        melody_strength,
        rhythm_strength,
        lyrics_strength,
        duration_seconds,
        music_progress,
        quality_score
      ),
      studio:city_studios!recording_sessions_studio_id_fkey (
        id,
        name,
        city_id
      ),
      producer:recording_producers!recording_sessions_producer_id_fkey (
        id,
        name
      )
    `,
    )
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const sessions = (data as SessionQueryRow[]) ?? [];
  if (!sessions.length) {
    console.log(`No recording sessions updated within the last ${hours}h`);
    return;
  }

  const results = [];
  for (const session of sessions) {
    const nextVersion = await fetchNextVersion(session.id);
    const stems = await fetchStemDescriptors(session.id, stemBucket);
    const metadata = buildMetadata(session, stems);
    const promptArtifact = buildSessionPromptArtifact({
      metadata,
      stems,
      lyrics: session.song?.lyrics ?? null,
    });

    if (dryRun) {
      results.push({ sessionId: session.id, version: nextVersion, dryRun: true, stems: stems.length });
      console.log(
        `DRY RUN: built prompt for session ${session.id} v${nextVersion} (${stems.length} stems, ${promptArtifact.tokenEstimate} tokens)`,
      );
      continue;
    }

    await persistPrompt(session.id, session.song_id, nextVersion, promptArtifact);
    await uploadPromptFile(session.id, nextVersion, promptArtifact, promptBucket);

    results.push({
      sessionId: session.id,
      version: nextVersion,
      stems: stems.length,
      tokens: promptArtifact.tokenEstimate,
    });

    console.log(
      `Stored prompt for session ${session.id} v${nextVersion} (${stems.length} stems, ${promptArtifact.tokenEstimate} tokens)`,
    );
  }

  console.log(`Processed ${results.length} recording sessions.`);
}

const fetchNextVersion = async (sessionId: string) => {
  const { data, error } = await supabase
    .from("session_prompt_artifacts")
    .select("version")
    .eq("session_id", sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return ((data?.version as number | undefined) ?? 0) + 1;
};

const fetchStemDescriptors = async (sessionId: string, bucket: string): Promise<StemDescriptor[]> => {
  const { data, error } = await supabase.storage.from(bucket).list(sessionId, {
    limit: 200,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    console.warn(`Unable to list stems for session ${sessionId}:`, error.message);
    return [];
  }

  const stems: StemDescriptor[] = [];
  for (const entry of data ?? []) {
    if (entry.name.endsWith("/")) {
      continue;
    }

    const storagePath = `${sessionId}/${entry.name}`;
    let downloadUrl: string | null = null;
    const { data: signedUrl } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60, { download: entry.name });
    if (signedUrl?.signedUrl) {
      downloadUrl = signedUrl.signedUrl;
    }

    stems.push({
      name: entry.name,
      storagePath,
      downloadUrl,
      lengthSeconds: (entry.metadata as { duration_seconds?: number } | undefined)?.duration_seconds ?? null,
    });
  }

  return stems;
};

const buildMetadata = (session: SessionQueryRow, stems: StemDescriptor[]): SessionPromptMetadata => ({
  sessionId: session.id,
  songId: session.song_id,
  songTitle: session.song?.title ?? "Untitled Session",
  genre: session.song?.genre ?? undefined,
  tempo: undefined,
  durationSeconds: session.song?.duration_seconds ?? undefined,
  durationHours: session.duration_hours ?? undefined,
  mood: session.status?.includes("party") ? "Party-mode" : undefined,
  arrangementStrength: session.song?.arrangement_strength ?? undefined,
  melodyStrength: session.song?.melody_strength ?? undefined,
  rhythmStrength: session.song?.rhythm_strength ?? undefined,
  lyricsStrength: session.song?.lyrics_strength ?? undefined,
  studioName: session.studio?.name ?? undefined,
  cityId: session.studio?.city_id ?? undefined,
  producerName: session.producer?.name ?? undefined,
  recordingVersion: session.recording_version ?? undefined,
  qualityImprovement: session.quality_improvement ?? undefined,
  totalCost: session.total_cost ?? undefined,
  status: session.status ?? undefined,
  updatedAt: session.updated_at ?? undefined,
  qualityScore: session.song?.quality_score ?? undefined,
  lyricsProgress: session.song?.lyrics_progress ?? undefined,
  musicProgress: session.song?.music_progress ?? undefined,
  extraMetadata: {
    scheduled_start: session.scheduled_start,
    scheduled_end: session.scheduled_end,
    band_id: session.band_id,
    stem_count: stems.length,
  } satisfies Json,
});

const persistPrompt = async (
  sessionId: string,
  songId: string,
  version: number,
  artifact: ReturnType<typeof buildSessionPromptArtifact>,
) => {
  const { error } = await supabase.from("session_prompt_artifacts").insert({
    session_id: sessionId,
    song_id: songId,
    version,
    prompt: artifact.prompt as Json,
    summary: artifact.summary,
    metadata: artifact.metadata as Json,
    stem_paths: artifact.stemPaths,
    lyrics_excerpt: artifact.lyricsExcerpt,
    context_tokens: artifact.tokenEstimate,
  });

  if (error) {
    throw error;
  }
};

const uploadPromptFile = async (
  sessionId: string,
  version: number,
  artifact: ReturnType<typeof buildSessionPromptArtifact>,
  bucket: string,
) => {
  const key = `${sessionId}/v${version}.json`;
  const payload = {
    version,
    generated_at: new Date().toISOString(),
    prompt: artifact.prompt,
    summary: artifact.summary,
    token_estimate: artifact.tokenEstimate,
  };

  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, JSON.stringify(payload, null, 2), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw error;
  }
};

type ArgMap = Record<string, string | boolean>;
function parseArgs(values: string[]): ArgMap {
  return values.reduce<ArgMap>((acc, current) => {
    if (!current.startsWith("--")) {
      return acc;
    }

    const [key, rawValue] = current.slice(2).split("=");
    acc[key] = rawValue ?? true;
    return acc;
  }, {});
}

main().catch((error) => {
  console.error("Failed to build session prompts:", error);
  process.exitCode = 1;
});
