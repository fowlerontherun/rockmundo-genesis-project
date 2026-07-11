export const GIG_VIEWER_VERSION = 1;
export const GIG_EVENT_SCHEMA_VERSION = 1;
export const GIG_REPLAY_TARGET_DURATION_MS = 180_000;
export const GIG_REPLAY_TARGET_TOLERANCE_MS = 15_000;

export const GIG_VIEWER_PHASES = [
  "venue_opening",
  "crowd_entry",
  "pre_show",
  "band_entrance",
  "song_intro",
  "song_performance",
  "between_songs",
  "highlight_moment",
  "encore_decision",
  "finale",
  "band_exit",
  "result_reveal",
  "completed",
] as const;

export const GIG_VIEWER_EVENT_TYPES = [
  "venue_opened",
  "crowd_arrived",
  "pre_show_started",
  "performer_entered",
  "performer_moved",
  "song_started",
  "song_crowd_reaction",
  "song_highlight",
  "song_montage",
  "between_song_transition",
  "encore_decided",
  "finale_started",
  "band_exited",
  "result_revealed",
  "replay_completed",
] as const;

export const GIG_REPLAY_STATUSES = ["generating", "ready", "failed", "legacy_unavailable"] as const;
