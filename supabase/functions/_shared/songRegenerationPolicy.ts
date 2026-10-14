// Pure preflight policy shared by the player endpoint and its regression tests.
// Replacement must be explicit: retries/automatic recording completion do not
// overwrite an existing recording merely because an audio URL is present.
export interface SongAudioState {
  audio_url: string | null;
  audio_generation_status: string | null;
  audio_generation_started_at: string | null;
}

export type GenerationBlock = "already_generating" | "confirmation_required" | null;

export function getGenerationBlock(
  state: SongAudioState,
  explicitReplacement: boolean,
  now = Date.now(),
): GenerationBlock {
  if (state.audio_generation_status === "generating") {
    const startMs = state.audio_generation_started_at
      ? Date.parse(state.audio_generation_started_at)
      : now;
    // Unparseable or missing timestamps should not silently release the lock.
    if (!Number.isFinite(startMs) || now - startMs < 15 * 60 * 1000) {
      return "already_generating";
    }
  }
  if (state.audio_url && !explicitReplacement) {
    return "confirmation_required";
  }
  return null;
}
