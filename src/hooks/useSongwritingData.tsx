import { MutableRefObject, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SONGWRITING_SCHEMA_FEATURES = {
  lyrics: "lyrics-column",
  estimatedCompletion: "estimated-completion",
  sessionsCompleted: "sessions-completed",
  sessionsStartedAt: "sessions-started-at",
  projectExtendedMetadata: "project-extended-metadata",
  projectAttributeScores: "project-attribute-scores",
  projectRatingFlags: "project-rating-flags",
  sessionExtendedTracking: "session-extended-tracking",
} as const;

type SongwritingSchemaFeature =
  (typeof SONGWRITING_SCHEMA_FEATURES)[keyof typeof SONGWRITING_SCHEMA_FEATURES];

const SCHEMA_SUPPORT_STORAGE_PREFIX = "songwriting:schema-support:";

const getSchemaSupportStorageKey = (feature: SongwritingSchemaFeature) =>
  `${SCHEMA_SUPPORT_STORAGE_PREFIX}${feature}`;

const readSchemaSupportFlag = (
  feature: SongwritingSchemaFeature,
  fallback: boolean,
): boolean => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const storedValue = window.localStorage.getItem(
      getSchemaSupportStorageKey(feature),
    );

    if (storedValue === "1") {
      return true;
    }

    if (storedValue === "0") {
      return false;
    }
  } catch (storageError) {
    console.debug("Unable to read songwriting schema support flag.", {
      feature,
      error: storageError,
    });
  }

  return fallback;
};

const persistSchemaSupportFlag = (
  feature: SongwritingSchemaFeature,
  value: boolean,
) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getSchemaSupportStorageKey(feature),
      value ? "1" : "0",
    );
  } catch (storageError) {
    console.debug("Unable to persist songwriting schema support flag.", {
      feature,
      error: storageError,
    });
  }
};

const updateSchemaSupportRef = (
  ref: MutableRefObject<boolean>,
  feature: SongwritingSchemaFeature,
  value: boolean,
) => {
  ref.current = value;
  persistSchemaSupportFlag(feature, value);
};

const persistSchemaSupportFromRef = (
  ref: MutableRefObject<boolean>,
  feature: SongwritingSchemaFeature,
) => {
  persistSchemaSupportFlag(feature, ref.current);
};

type SongAttributeKey = "concept" | "lyrics" | "melody" | "production" | "performance";

export type SongAttributeScores = Record<SongAttributeKey, number>;

export interface SongOwnershipMetadata {
  ownerUserId: string;
  ownerProfileId?: string | null;
  coWriterUserIds?: string[];
  coWriterSplits?: number[] | null;
}

const SONG_ATTRIBUTE_KEYS: SongAttributeKey[] = [
  "concept",
  "lyrics",
  "melody",
  "production",
  "performance",
];

const ATTRIBUTE_COLUMN_ALIASES: Record<SongAttributeKey, string[]> = {
  concept: ["concept_score", "concept_rating", "concept_strength", "concept"],
  lyrics: ["lyrics_score", "lyrics_rating", "lyricism_score", "lyrics"],
  melody: ["melody_score", "melody_rating", "composition_score", "melody"],
  production: ["production_score", "production_rating", "studio_score", "production"],
  performance: ["performance_score", "performance_rating", "delivery_score", "performance"],
};

const MIN_SESSION_HOURS = 6;
const MAX_SESSION_HOURS = 12;
const DEFAULT_SESSION_HOURS = 8;

const clampNumber = (value: number, lower: number, upper: number) =>
  Math.max(lower, Math.min(upper, value));

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0);
};

const sanitizeGenreSelection = (value: unknown): string[] => {
  const normalized = sanitizeStringArray(value);
  if (normalized.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  normalized.forEach((genre) => {
    const key = genre.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(genre);
  });

  return result;
};

const hasInstrumentFamiliarity = (
  skills:
    | null
    | undefined
    | Partial<Record<"guitar" | "bass" | "drums" | "vocals" | "songwriting", number>>,
): boolean => {
  if (!skills) {
    return false;
  }

  const instrumentKeys: Array<"guitar" | "bass" | "drums" | "vocals"> = [
    "guitar",
    "bass",
    "drums",
    "vocals",
  ];

  return instrumentKeys.some((key) => {
    const value = skills[key];
    const parsed = toNumberOrNull(value ?? null);
    return parsed !== null && parsed >= 10;
  });
};

const validateGenreSelection = (
  genres: string[] | null | undefined,
  skills:
    | null
    | undefined
    | Partial<Record<"guitar" | "bass" | "drums" | "vocals" | "songwriting", number>>,
) => {
  if (!genres || genres.length === 0) {
    return;
  }

  if (hasInstrumentFamiliarity(skills)) {
    return;
  }

  throw new Error(
    "You need at least one instrument at familiarity 10 or above before targeting specific genres.",
  );
};

const sanitizeCoWriterMetadata = (
  coWriters: string[] | null | undefined,
  rawSplits: number[] | null | undefined,
): { coWriters: string[] | null; splits: number[] | null } => {
  const sanitizedCoWriters = sanitizeStringArray(coWriters).map((value) => value.trim());

  if (sanitizedCoWriters.length === 0) {
    return { coWriters: null, splits: null };
  }

  const sanitizedSplits = Array.isArray(rawSplits)
    ? rawSplits.map((value) => clampNumber(toNumberOrNull(value) ?? 0, 0, 100))
    : [];

  if (sanitizedSplits.length > 0 && sanitizedSplits.length !== sanitizedCoWriters.length) {
    throw new Error("Each co-writer must have a corresponding royalty split percentage.");
  }

  const totalSplits = sanitizedSplits.reduce((total, value) => total + value, 0);
  if (totalSplits > 100.0001) {
    throw new Error("Co-writer royalty splits cannot exceed 100%. Please adjust the distribution.");
  }

  return {
    coWriters: sanitizedCoWriters,
    splits: sanitizedSplits.length > 0 ? sanitizedSplits : null,
  };
};

const extractAttributeScores = (record: Record<string, unknown>): SongAttributeScores => {
  const attributeScores: Partial<SongAttributeScores> = {};

  const rawScores = record["attribute_scores"];
  if (rawScores && typeof rawScores === "object" && !Array.isArray(rawScores)) {
    SONG_ATTRIBUTE_KEYS.forEach((key) => {
      const rawValue = (rawScores as Record<string, unknown>)[key];
      const parsed = toNumberOrNull(rawValue);
      if (parsed !== null) {
        attributeScores[key] = parsed;
      }
    });
  }

  SONG_ATTRIBUTE_KEYS.forEach((key) => {
    if (attributeScores[key] !== undefined) {
      return;
    }

    const aliases = ATTRIBUTE_COLUMN_ALIASES[key];
    for (const alias of aliases) {
      if (record[alias] === undefined) {
        continue;
      }

      const parsed = toNumberOrNull(record[alias]);
      if (parsed !== null) {
        attributeScores[key] = parsed;
        break;
      }
    }
  });

  const normalized: SongAttributeScores = {
    concept: attributeScores.concept ?? 0,
    lyrics: attributeScores.lyrics ?? 0,
    melody: attributeScores.melody ?? 0,
    production: attributeScores.production ?? 0,
    performance: attributeScores.performance ?? 0,
  };

  return normalized;
};

const computeSongRatingFromScores = (scores: SongAttributeScores | null | undefined): number => {
  if (!scores) {
    return 0;
  }

  const sum = SONG_ATTRIBUTE_KEYS.reduce((total, key) => {
    const value = scores[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      return total;
    }
    const clamped = clampNumber(value, 0, 200);
    return total + clamped;
  }, 0);

  if (sum <= 0) {
    return 0;
  }

  const normalized = (sum / (SONG_ATTRIBUTE_KEYS.length * 200)) * 1000;
  return Math.round(clampNumber(normalized, 0, 1000));
};

const shouldRevealSongRating = (status: string | null | undefined): boolean => {
  if (!status) {
    return false;
  }

  const normalized = status.toLowerCase();
  return (
    normalized === "rehearsal" ||
    normalized === "rehearsing" ||
    normalized === "recording" ||
    normalized === "mixing" ||
    normalized === "mastering" ||
    normalized === "released" ||
    normalized === "completed"
  );
};

const buildOwnershipMetadata = (
  project: Record<string, unknown>,
  fallbackUserId: string,
): SongOwnershipMetadata => {
  const coWriterUserIds = sanitizeStringArray(project["co_writers"]);
  const coWriterSplitsRaw = project["co_writer_splits"];
  const coWriterSplits = Array.isArray(coWriterSplitsRaw)
    ? coWriterSplitsRaw
        .map((value) => toNumberOrNull(value) ?? 0)
        .map((value) => clampNumber(value, 0, 100))
    : null;

  const ownerProfileId =
    typeof project["rating_owner_profile_id"] === "string"
      ? (project["rating_owner_profile_id"] as string)
      : null;

  return {
    ownerUserId: fallbackUserId,
    ownerProfileId,
    coWriterUserIds,
    coWriterSplits,
  };
};

const sanitizeEffortHours = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_SESSION_HOURS;
  }

  return clampNumber(Math.round(value), MIN_SESSION_HOURS, MAX_SESSION_HOURS);
};

const computeAttributeModifier = (
  score: number | null | undefined,
  baseline = 50,
  spread = 250,
): number => {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 1;
  }

  const modifier = 1 + (score - baseline) / spread;
  return clampNumber(modifier, 0.7, 1.4);
};

const MOOD_INFLUENCED_ATTRIBUTES: SongAttributeKey[] = ["lyrics", "performance"];
const HEALTH_INFLUENCED_ATTRIBUTES: SongAttributeKey[] = ["production", "performance"];
const INSPIRATION_INFLUENCED_ATTRIBUTES: SongAttributeKey[] = [
  "concept",
  "melody",
  "lyrics",
];

export interface SongTheme {
  id: string;
  name: string;
  description: string | null;
  mood: string | null;
}

export interface ChordProgression {
  id: string;
  name: string;
  progression: string;
  difficulty: number;
}

export interface SongwritingProject {
  id: string;
  user_id: string;
  title: string;
  theme_id: string | null;
  chord_progression_id: string | null;
  initial_lyrics: string | null;
  lyrics?: string | null;
  music_progress: number;
  lyrics_progress: number;
  total_sessions: number;
  estimated_completion_sessions?: number | null;
  estimated_sessions?: number | null;
  quality_score: number;
  status: string | null;
  is_locked: boolean;
  locked_until: string | null;
  sessions_completed: number;
  song_id?: string | null;
  created_at: string;
  updated_at: string;
  song_themes?: SongTheme;
  chord_progressions?: ChordProgression;
  songwriting_sessions?: SongwritingSession[];
  purpose?: string | null;
  mode?: string | null;
  genres?: string[] | null;
  co_writers?: string[] | null;
  co_writer_splits?: number[] | null;
  attribute_scores?: SongAttributeScores | null;
  computed_song_rating?: number | null;
  rating_hidden?: boolean | null;
  rating_visible?: boolean | null;
  rating_revealed_at?: string | null;
  rating_revealed_stage?: string | null;
  revealed_song_rating?: number | null;
  rating_owner_profile_id?: string | null;
  rating_owner_user_id?: string | null;
  ownership_metadata?: SongOwnershipMetadata;
  initial_production_potential?: number | null;
  production_potential?: number | null;
  production_potential_revealed_at?: string | null;
  production_potential_revealed?: boolean | null;
  co_writer_contributions?: Record<string, number> | null;
}

export interface SongwritingSession {
  id: string;
  project_id: string;
  user_id: string;
  session_start: string;
  session_end: string | null;
  started_at?: string;
  completed_at?: string | null;
  locked_until?: string | null;
  music_progress_gained: number;
  lyrics_progress_gained: number;
  xp_earned: number;
  notes: string | null;
  effort_hours?: number | null;
  duration_minutes?: number | null;
  pause_state?: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  attribute_gains?: SongAttributeScores | null;
  mood_modifier?: number | null;
  health_modifier?: number | null;
  inspiration_modifier?: number | null;
  co_writer_contributions?: Record<string, number> | null;
  royalty_split_snapshot?: Record<string, number> | null;
}

type CreateProjectInput = {
  title: string;
  theme_id: string | null;
  chord_progression_id: string | null;
  initial_lyrics?: string;
  genres?: string[] | null;
  purpose?: string | null;
  mode?: string | null;
  initial_production_potential?: number | null;
  co_writers?: string[] | null;
  co_writer_splits?: number[] | null;
};

type UpdateProjectInput = {
  id: string;
  title?: string;
  theme_id?: string | null;
  chord_progression_id?: string | null;
  estimated_completion_sessions?: number;
  estimated_sessions?: number | null;
  quality_score?: number;
  status?: string;
  initial_lyrics?: string | null;
  lyrics?: string | null;
  song_id?: string | null;
  genres?: string[] | null;
  purpose?: string | null;
  mode?: string | null;
  initial_production_potential?: number | null;
  production_potential?: number | null;
  co_writers?: string[] | null;
  co_writer_splits?: number[] | null;
  attribute_scores?: Partial<SongAttributeScores> | null;
};

type CompleteSessionInput = {
  sessionId: string;
  notes?: string;
  effortHours?: number | null;
  paused?: boolean;
  resumeAt?: string | null;
  coWriterAdjustments?: Record<string, number> | null;
};

type StartSessionInput = {
  projectId: string;
  effortHours?: number | null;
  resumeSessionId?: string | null;
};

const QUALITY_BANDS = [
  { min: 0, max: 599, label: "Amateur", hint: "Rough idea – keep iterating." },
  { min: 600, max: 1099, label: "Rising", hint: "Momentum is building." },
  { min: 1100, max: 1499, label: "Professional", hint: "Great craftsmanship on display." },
  { min: 1500, max: 1800, label: "Hit Potential", hint: "Strong release candidate." },
  { min: 1801, max: 2000, label: "Masterpiece", hint: "A career highlight." },
] as const;

export type SongQualityDescriptor = (typeof QUALITY_BANDS)[number];

export const getSongQualityDescriptor = (score: number): SongQualityDescriptor & { score: number } => {
  const normalized = Number.isFinite(score) ? Math.max(0, Math.min(2000, Math.round(score))) : 0;
  const band = QUALITY_BANDS.find((entry) => normalized >= entry.min && normalized <= entry.max) ?? QUALITY_BANDS[0];
  return { ...band, score: normalized };
};

export const useSongwritingData = (userId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const songThemesTableAvailableRef = useRef(true);
  const chordProgressionsTableAvailableRef = useRef(true);
  const songwritingProjectsTableAvailableRef = useRef(true);
  const songwritingSessionsTableAvailableRef = useRef(true);
  const songwritingSessionsStartedAtSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.sessionsStartedAt, true),
  );
  const songwritingLyricsColumnSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.lyrics, true),
  );
  const songwritingEstimatedCompletionSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.estimatedCompletion, true),
  );
  const songwritingSessionsCompletedSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.sessionsCompleted, true),
  );
  const songwritingProjectExtendedMetadataSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata, true),
  );
  const songwritingProjectAttributeScoresSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.projectAttributeScores, true),
  );
  const songwritingProjectRatingFlagsSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.projectRatingFlags, true),
  );
  const songwritingSessionExtendedTrackingSupportedRef = useRef(
    readSchemaSupportFlag(SONGWRITING_SCHEMA_FEATURES.sessionExtendedTracking, true),
  );

  const activeUserId = typeof userId === "string" && userId.length > 0 ? userId : null;

  const normalizeErrorContext = (error: unknown) => {
    if (!error || typeof error !== "object") {
      return null;
    }

    const candidate = error as {
      code?: string;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    };

    const haystack = [candidate.message, candidate.details, candidate.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ")
      .toLowerCase();

    return {
      code: candidate.code,
      haystack,
    };
  };

  const computeEstimatedCompletionSessions = (
    project:
      | {
          estimated_completion_sessions?: number | null;
          estimated_sessions?: number | null;
          total_sessions?: number | null;
        }
      | null
      | undefined,
  ): number => {
    const completionValue = project?.estimated_completion_sessions;
    if (typeof completionValue === "number" && Number.isFinite(completionValue)) {
      return completionValue;
    }

    const legacyValue = project?.estimated_sessions;
    if (typeof legacyValue === "number" && Number.isFinite(legacyValue)) {
      return legacyValue;
    }

    const totalSessions = project?.total_sessions;
    if (typeof totalSessions === "number" && Number.isFinite(totalSessions)) {
      return Math.max(1, totalSessions);
    }

    return 3;
  };

  const normalizeProjectRow = <T extends Record<string, unknown>>(project: T): T & {
    estimated_completion_sessions: number;
  } => {
    const normalized = {
      ...project,
      estimated_completion_sessions: computeEstimatedCompletionSessions(
        project as unknown as {
          estimated_completion_sessions?: number | null;
          estimated_sessions?: number | null;
          total_sessions?: number | null;
        },
      ),
    } as Record<string, unknown>;

    if (
      normalized["lyrics"] === undefined &&
      Object.prototype.hasOwnProperty.call(normalized, "initial_lyrics")
    ) {
      normalized["lyrics"] =
        (normalized["initial_lyrics"] as string | null | undefined) ?? null;
    }

    const rawSessionsCompleted = normalized["sessions_completed"];
    const normalizedSessionsCompleted =
      typeof rawSessionsCompleted === "number" && Number.isFinite(rawSessionsCompleted)
        ? rawSessionsCompleted
        : (() => {
            const totalSessions = normalized["total_sessions"];
            if (typeof totalSessions === "number" && Number.isFinite(totalSessions)) {
              return Math.max(0, totalSessions);
            }
            return 0;
          })();

    normalized["sessions_completed"] = normalizedSessionsCompleted;

    const genresFromPayload =
      normalized["genres"] ?? normalized["genre_focus"] ?? normalized["genre_tags"];
    normalized["genres"] = sanitizeStringArray(genresFromPayload);

    const purposeCandidate =
      typeof normalized["purpose"] === "string"
        ? normalized["purpose"]
        : typeof normalized["project_purpose"] === "string"
          ? normalized["project_purpose"]
          : null;
    normalized["purpose"] = purposeCandidate;

    const modeCandidate =
      typeof normalized["mode"] === "string"
        ? normalized["mode"]
        : typeof normalized["project_mode"] === "string"
          ? normalized["project_mode"]
          : null;
    normalized["mode"] = modeCandidate;

    const coWriters = sanitizeStringArray(normalized["co_writers"]);
    normalized["co_writers"] = coWriters;

    const coWriterSplitsRaw = normalized["co_writer_splits"];
    normalized["co_writer_splits"] = Array.isArray(coWriterSplitsRaw)
      ? coWriterSplitsRaw
          .map((value) => toNumberOrNull(value) ?? 0)
          .map((value) => clampNumber(value, 0, 100))
      : null;

    const attributeScores = extractAttributeScores(normalized);
    normalized["attribute_scores"] = attributeScores;

    const computedSongRating = computeSongRatingFromScores(attributeScores);
    normalized["computed_song_rating"] = computedSongRating;

    const statusValue = typeof normalized["status"] === "string" ? normalized["status"] : null;
    const ratingHiddenRaw = normalized["rating_hidden"];
    const ratingHidden =
      typeof ratingHiddenRaw === "boolean"
        ? ratingHiddenRaw
        : !shouldRevealSongRating(statusValue);
    const ratingVisible = shouldRevealSongRating(statusValue) && !ratingHidden;

    normalized["rating_hidden"] = ratingHidden;
    normalized["rating_visible"] = ratingVisible;
    normalized["revealed_song_rating"] = ratingVisible ? computedSongRating : null;

    if (typeof normalized["rating_revealed_at"] !== "string" && ratingVisible) {
      normalized["rating_revealed_at"] = new Date().toISOString();
    }

    if (typeof normalized["rating_revealed_stage"] !== "string" && ratingVisible && statusValue) {
      normalized["rating_revealed_stage"] = statusValue;
    }

    const ownerUserId =
      typeof normalized["user_id"] === "string" ? (normalized["user_id"] as string) : "";
    normalized["ownership_metadata"] = buildOwnershipMetadata(normalized, ownerUserId);

    const initialProductionPotential = toNumberOrNull(
      normalized["initial_production_potential"],
    );
    normalized["initial_production_potential"] =
      initialProductionPotential === null
        ? null
        : clampNumber(initialProductionPotential, 0, 100);

    const productionPotential = toNumberOrNull(normalized["production_potential"]);
    normalized["production_potential"] =
      productionPotential === null ? null : clampNumber(productionPotential, 0, 100);

    const coWriterContributionsRaw = normalized["co_writer_contributions"];
    if (
      coWriterContributionsRaw &&
      typeof coWriterContributionsRaw === "object" &&
      !Array.isArray(coWriterContributionsRaw)
    ) {
      const entries = Object.entries(coWriterContributionsRaw as Record<string, unknown>).map(
        ([key, value]) => {
          const parsed = toNumberOrNull(value) ?? 0;
          return [key, parsed] as const;
        },
      );
      normalized["co_writer_contributions"] = Object.fromEntries(entries);
    } else {
      normalized["co_writer_contributions"] = null;
    }

    return normalized as T & { estimated_completion_sessions: number };
  };

  const normalizeProjects = (rows: unknown[] | null | undefined): SongwritingProject[] => {
    if (!Array.isArray(rows)) {
      return [] as SongwritingProject[];
    }

    return rows.map((row) => normalizeProjectRow(row as Record<string, unknown>)) as any;
  };

  const isMissingTableError = (error: unknown, tableName: string): boolean => {
    if (!error || typeof error !== "object") {
      return false;
    }

    const context = normalizeErrorContext(error);

    if (!context) {
      return false;
    }

    const knownMissingCodes = new Set(["PGRST201", "PGRST202", "PGRST205", "42P01"]);

    if (context.code && knownMissingCodes.has(context.code)) {
      return true;
    }

    if (!context.haystack) {
      return false;
    }

    if (!context.haystack.includes(tableName.toLowerCase())) {
      return false;
    }

    return (
      context.haystack.includes("schema cache") ||
      context.haystack.includes("relation") ||
      context.haystack.includes("table") ||
      context.haystack.includes("not found")
    );
  };

  const isMissingColumnError = (error: unknown, columnName: string): boolean => {
    const context = normalizeErrorContext(error);

    if (!context) {
      return false;
    }

    if (context.code === "42703") {
      return true;
    }

    if (!context.haystack) {
      return false;
    }

    return (
      context.haystack.includes(`${columnName.toLowerCase()}`) &&
      (context.haystack.includes("column") || context.haystack.includes("does not exist"))
    );
  };

  const markTableUnavailable = (
    tableRef: MutableRefObject<boolean>,
    tableName: string,
    error: unknown,
  ) => {
    tableRef.current = false;
    const debugInfo =
      typeof error === "object" && error !== null
        ? error
        : { error: String(error) };
    console.warn(`${tableName} table is unavailable; using empty data.`, debugInfo);
  };

  const persistSongwritingSchemaSupport = () => {
    persistSchemaSupportFromRef(
      songwritingLyricsColumnSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.lyrics,
    );
    persistSchemaSupportFromRef(
      songwritingEstimatedCompletionSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
    );
    persistSchemaSupportFromRef(
      songwritingSessionsCompletedSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
    );
    persistSchemaSupportFromRef(
      songwritingSessionsStartedAtSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.sessionsStartedAt,
    );
    persistSchemaSupportFromRef(
      songwritingProjectExtendedMetadataSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
    );
    persistSchemaSupportFromRef(
      songwritingProjectAttributeScoresSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
    );
    persistSchemaSupportFromRef(
      songwritingProjectRatingFlagsSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
    );
    persistSchemaSupportFromRef(
      songwritingSessionExtendedTrackingSupportedRef,
      SONGWRITING_SCHEMA_FEATURES.sessionExtendedTracking,
    );
  };

  const handleMissingSongwritingTableError = (error: unknown): boolean => {
    let handled = false;

    if (
      songwritingSessionsCompletedSupportedRef.current &&
      isMissingColumnError(error, "sessions_completed")
    ) {
      updateSchemaSupportRef(
        songwritingSessionsCompletedSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
        false,
      );
      console.warn(
        "Songwriting projects sessions_completed column unavailable; continuing without it.",
        error,
      );
      handled = true;
    }

    if (isMissingTableError(error, "songwriting_projects")) {
      markTableUnavailable(songwritingProjectsTableAvailableRef, "Songwriting projects", error);
      handled = true;
    }

    if (isMissingColumnError(error, "lyrics")) {
      updateSchemaSupportRef(
        songwritingLyricsColumnSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.lyrics,
        false,
      );
      console.warn(
        "Songwriting projects lyrics column unavailable; falling back to initial_lyrics.",
        error,
      );
      handled = true;
    }

    if (isMissingColumnError(error, "estimated_completion_sessions")) {
      updateSchemaSupportRef(
        songwritingEstimatedCompletionSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
        false,
      );
      console.warn(
        "Songwriting projects estimated_completion_sessions column unavailable; falling back to legacy estimated_sessions.",
        error,
      );
      handled = true;
    }

    if (
      songwritingProjectExtendedMetadataSupportedRef.current &&
      [
        "purpose",
        "mode",
        "genres",
        "co_writers",
        "co_writer_splits",
        "initial_production_potential",
        "production_potential",
        "production_potential_revealed",
      ].some((column) => isMissingColumnError(error, column))
    ) {
      updateSchemaSupportRef(
        songwritingProjectExtendedMetadataSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
        false,
      );
      console.warn(
        "Songwriting projects extended metadata columns unavailable; disabling extended metadata support.",
        error,
      );
      handled = true;
    }

    if (
      songwritingProjectAttributeScoresSupportedRef.current &&
      SONG_ATTRIBUTE_KEYS.some((key) =>
        ATTRIBUTE_COLUMN_ALIASES[key].some((column) => isMissingColumnError(error, column)),
      )
    ) {
      updateSchemaSupportRef(
        songwritingProjectAttributeScoresSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
        false,
      );
      console.warn(
        "Songwriting projects attribute score columns unavailable; falling back to legacy scoring.",
        error,
      );
      handled = true;
    }

    if (
      songwritingProjectRatingFlagsSupportedRef.current &&
      [
        "rating_hidden",
        "rating_visible",
        "rating_revealed_at",
        "rating_revealed_stage",
        "rating_owner_profile_id",
        "rating_owner_user_id",
      ].some((column) => isMissingColumnError(error, column))
    ) {
      updateSchemaSupportRef(
        songwritingProjectRatingFlagsSupportedRef,
        SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
        false,
      );
      console.warn(
        "Songwriting projects rating metadata columns unavailable; disabling rating flag support.",
        error,
      );
      handled = true;
    }

    if (isMissingTableError(error, "songwriting_sessions")) {
      markTableUnavailable(songwritingSessionsTableAvailableRef, "Songwriting sessions", error);
      handled = true;
    }

    if (isMissingTableError(error, "song_themes")) {
      markTableUnavailable(songThemesTableAvailableRef, "Song themes", error);
      handled = true;
    }

    if (isMissingTableError(error, "chord_progressions")) {
      markTableUnavailable(chordProgressionsTableAvailableRef, "Chord progressions", error);
      handled = true;
    }

    return handled;
  };

  const { data: themes, isLoading: isLoadingThemes } = useQuery({
    queryKey: ["song-themes"],
    queryFn: async () => {
      if (!songThemesTableAvailableRef.current) {
        return [] as SongTheme[];
      }

      const { data, error } = await supabase
        .from("song_themes")
        .select("*")
        .order("name");

      if (error) {
        if (handleMissingSongwritingTableError(error)) {
          return [] as SongTheme[];
        }
        throw error;
      }

      songThemesTableAvailableRef.current = true;
      return data as SongTheme[];
    },
  });

  const { data: chordProgressions, isLoading: isLoadingChordProgressions } = useQuery({
    queryKey: ["chord-progressions"],
    queryFn: async () => {
      if (!chordProgressionsTableAvailableRef.current) {
        return [] as ChordProgression[];
      }

      const { data, error } = await supabase
        .from("chord_progressions")
        .select("*")
        .order("difficulty", { ascending: true });

      if (error) {
        if (handleMissingSongwritingTableError(error)) {
          return [] as ChordProgression[];
        }
        throw error;
      }

      chordProgressionsTableAvailableRef.current = true;
      return data as ChordProgression[];
    },
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["songwriting-projects", activeUserId ?? "anonymous"],
    queryFn: async () => {
      if (!songwritingProjectsTableAvailableRef.current || !activeUserId) {
        return [] as SongwritingProject[];
      }

      const buildSelect = (
        includeSessions: boolean,
        includeStartedAt: boolean,
        includeEstimatedCompletion: boolean,
      ) => {
        const projectFields = [
          "id",
          "user_id",
          "title",
          "theme_id",
          "chord_progression_id",
          "initial_lyrics",
          songwritingLyricsColumnSupportedRef.current ? "lyrics" : null,
          "music_progress",
          "lyrics_progress",
          "total_sessions",
          includeEstimatedCompletion ? "estimated_completion_sessions" : null,
          "estimated_sessions",
          "quality_score",
          "status",
          "is_locked",
          "locked_until",
          songwritingSessionsCompletedSupportedRef.current ? "sessions_completed" : null,
          "song_id",
          "created_at",
          "updated_at",
          songwritingProjectExtendedMetadataSupportedRef.current ? "purpose" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "mode" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "genres" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writers" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writer_splits" : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "initial_production_potential"
            : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "production_potential"
            : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "production_potential_revealed"
            : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "production_potential_revealed_at"
            : null,
          songwritingProjectAttributeScoresSupportedRef.current ? "attribute_scores" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_hidden" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_visible" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_revealed_at" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_revealed_stage" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_user_id" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_profile_id" : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "co_writer_contributions"
            : null,
        ].filter((field): field is string => typeof field === "string" && field.length > 0);

        const selections = [
          projectFields.join(","),
          "song_themes (id, name, description, mood)",
          "chord_progressions (id, name, progression, difficulty)",
        ];

        if (includeSessions) {
          const sessionFields = [
            "id",
            "project_id",
            "user_id",
            "session_start",
            "session_end",
            includeStartedAt ? "started_at" : null,
            "completed_at",
            "locked_until",
            "music_progress_gained",
            "lyrics_progress_gained",
            "xp_earned",
            "notes",
            "created_at",
            songwritingSessionExtendedTrackingSupportedRef.current ? "effort_hours" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "duration_minutes" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "pause_state" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "paused_at" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "resumed_at" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "attribute_gains" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "mood_modifier" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "health_modifier" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "inspiration_modifier" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "co_writer_contributions" : null,
            songwritingSessionExtendedTrackingSupportedRef.current ? "royalty_split_snapshot" : null,
          ].filter((field): field is string => typeof field === "string" && field.length > 0);

          selections.push(`songwriting_sessions (${sessionFields.join(",")})`);
        }

        return selections.join(",\n");
      };

      const performQuery = async (
        includeSessions: boolean,
        includeStartedAt: boolean,
        includeEstimatedCompletion: boolean,
      ) =>
        supabase
          .from("songwriting_projects")
          .select(buildSelect(includeSessions, includeStartedAt, includeEstimatedCompletion))
          .eq("user_id", activeUserId)
          .order("created_at", { ascending: false });

      const includeSessions = songwritingSessionsTableAvailableRef.current;
      const includeStartedAt = includeSessions && songwritingSessionsStartedAtSupportedRef.current;
      const includeEstimatedCompletion = songwritingEstimatedCompletionSupportedRef.current;

      const { data, error } = await performQuery(
        includeSessions,
        includeStartedAt,
        includeEstimatedCompletion,
      );

      if (error) {
        if (
          songwritingSessionsCompletedSupportedRef.current &&
          isMissingColumnError(error, "sessions_completed")
        ) {
          updateSchemaSupportRef(
            songwritingSessionsCompletedSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
            false,
          );
          console.warn(
            "Songwriting projects sessions_completed column unavailable during fetch; retrying without it.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await performQuery(
            includeSessions,
            includeStartedAt,
            includeEstimatedCompletion,
          );

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          persistSongwritingSchemaSupport();
          return normalizeProjects(fallbackData);
        }

        if (songwritingLyricsColumnSupportedRef.current && isMissingColumnError(error, "lyrics")) {
          updateSchemaSupportRef(
            songwritingLyricsColumnSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.lyrics,
            false,
          );
          console.warn(
            "Songwriting projects lyrics column unavailable; refetching without it.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await performQuery(
            includeSessions,
            includeStartedAt,
            songwritingEstimatedCompletionSupportedRef.current,
          );

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          persistSongwritingSchemaSupport();
          return normalizeProjects(fallbackData);
        }

        if (includeEstimatedCompletion && isMissingColumnError(error, "estimated_completion_sessions")) {
          updateSchemaSupportRef(
            songwritingEstimatedCompletionSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
            false,
          );
          console.warn(
            "Songwriting projects estimated_completion_sessions column unavailable during fetch; retrying without it.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await performQuery(
            includeSessions,
            includeStartedAt,
            false,
          );

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          persistSongwritingSchemaSupport();
          return normalizeProjects(fallbackData);
        }

        if (includeSessions && includeStartedAt && isMissingColumnError(error, "started_at")) {
          updateSchemaSupportRef(
            songwritingSessionsStartedAtSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.sessionsStartedAt,
            false,
          );
          console.warn(
            "Songwriting sessions started_at column unavailable; falling back to legacy session_start.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await performQuery(
            includeSessions,
            false,
            songwritingEstimatedCompletionSupportedRef.current,
          );

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          persistSongwritingSchemaSupport();
          return normalizeProjects(fallbackData);
        }

        if (includeSessions && isMissingTableError(error, "songwriting_sessions")) {
          songwritingSessionsTableAvailableRef.current = false;
          console.warn("Songwriting sessions relation unavailable; refetching without session data.", error);

          const { data: fallbackData, error: fallbackError } = await performQuery(
            false,
            false,
            songwritingEstimatedCompletionSupportedRef.current,
          );

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          persistSongwritingSchemaSupport();
          return normalizeProjects(fallbackData);
        }

        if (handleMissingSongwritingTableError(error)) {
          return [] as SongwritingProject[];
        }
        throw error;
      }

      songwritingProjectsTableAvailableRef.current = true;
      persistSongwritingSchemaSupport();
      return normalizeProjects(data);
    },
  });

  const createProject = useMutation({
    mutationFn: async (projectData: CreateProjectInput) => {
      if (!songwritingProjectsTableAvailableRef.current) {
        throw new Error("Songwriting projects are currently unavailable.");
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("User must be signed in to create a songwriting project");
      }

      const sanitizedThemeId = projectData.theme_id || null;
      const sanitizedProgressionId = projectData.chord_progression_id || null;
      const sanitizedLyrics = projectData.initial_lyrics?.trim() || null;
      const sanitizedGenres = sanitizeGenreSelection(projectData.genres);
      const sanitizedPurpose =
        typeof projectData.purpose === "string" && projectData.purpose.trim().length > 0
          ? projectData.purpose.trim()
          : null;
      const sanitizedMode =
        typeof projectData.mode === "string" && projectData.mode.trim().length > 0
          ? projectData.mode.trim()
          : null;
      const { coWriters: sanitizedCoWriters, splits: sanitizedSplits } =
        sanitizeCoWriterMetadata(projectData.co_writers ?? null, projectData.co_writer_splits ?? null);
      const sanitizedInitialProductionPotentialRaw = toNumberOrNull(
        projectData.initial_production_potential ?? null,
      );
      const sanitizedInitialProductionPotential =
        sanitizedInitialProductionPotentialRaw === null
          ? null
          : clampNumber(sanitizedInitialProductionPotentialRaw, 0, 100);

      const [{ data: skills, error: skillsError }, { data: attributes, error: attributesError }] = await Promise.all([
        supabase
          .from("player_skills")
          .select("songwriting, creativity, composition")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("player_attributes")
          .select("creative_insight, musical_ability")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (skillsError && skillsError.code !== "PGRST116") {
        throw skillsError;
      }

      if (attributesError && attributesError.code !== "PGRST116") {
        throw attributesError;
      }

      const estimateSessions = () => {
        const skillAverage =
          ((skills?.songwriting ?? 20) + (skills?.creativity ?? 20) + (skills?.composition ?? 20)) / 3;
        const attributeAverage = ((attributes?.creative_insight ?? 40) + (attributes?.musical_ability ?? 40)) / 2;

        const baseSessions = 4;
        const skillModifier = 1 - Math.min(0.45, skillAverage / 220);
        const attributeModifier = 1 - Math.min(0.3, attributeAverage / 260);
        const estimated = Math.round(baseSessions * skillModifier * attributeModifier);
        return Math.max(2, Math.min(6, estimated));
      };

      const estimatedSessions = estimateSessions();

      try {
        validateGenreSelection(sanitizedGenres, skills);
      } catch (validationError) {
        throw validationError;
      }

      const buildPayload = ({
        includeExtendedMetadata = songwritingProjectExtendedMetadataSupportedRef.current,
        includeAttributeScores = songwritingProjectAttributeScoresSupportedRef.current,
        includeRatingFlags = songwritingProjectRatingFlagsSupportedRef.current,
      }: {
        includeExtendedMetadata?: boolean;
        includeAttributeScores?: boolean;
        includeRatingFlags?: boolean;
      } = {}) => {
        const payload: Record<string, unknown> = {
          user_id: userId,
          title: projectData.title.trim(),
          theme_id: sanitizedThemeId,
          chord_progression_id: sanitizedProgressionId,
          initial_lyrics: sanitizedLyrics,
          estimated_sessions: estimatedSessions,
          quality_score: 1000,
          status: "draft",
          music_progress: 0,
          lyrics_progress: 0,
          total_sessions: 0,
          is_locked: false,
          locked_until: null,
        };

        if (songwritingSessionsCompletedSupportedRef.current) {
          payload.sessions_completed = 0;
        }

        if (songwritingLyricsColumnSupportedRef.current) {
          payload.lyrics = sanitizedLyrics;
        }

        if (songwritingEstimatedCompletionSupportedRef.current) {
          payload.estimated_completion_sessions = estimatedSessions;
        }

        if (includeExtendedMetadata) {
          payload.purpose = sanitizedPurpose;
          payload.mode = sanitizedMode;
          if (sanitizedGenres.length > 0) {
            payload.genres = sanitizedGenres;
          } else {
            payload.genres = [];
          }

          if (sanitizedCoWriters) {
            payload.co_writers = sanitizedCoWriters;
          } else {
            payload.co_writers = [];
          }

          if (sanitizedSplits) {
            payload.co_writer_splits = sanitizedSplits;
          } else if (sanitizedCoWriters && sanitizedCoWriters.length > 0) {
            payload.co_writer_splits = sanitizedCoWriters.map(() => 0);
          }

          payload.initial_production_potential = sanitizedInitialProductionPotential;
          payload.production_potential = sanitizedInitialProductionPotential;
        }

        if (includeAttributeScores) {
          payload.attribute_scores = {
            concept: 0,
            lyrics: 0,
            melody: 0,
            production: 0,
            performance: 0,
          } satisfies SongAttributeScores;
        }

        if (includeRatingFlags) {
          payload.rating_hidden = true;
          payload.rating_visible = false;
          payload.rating_revealed_at = null;
          payload.rating_revealed_stage = null;
          payload.rating_owner_user_id = userId;
          payload.rating_owner_profile_id = null;
        }

        return payload;
      };

      const attemptInsert = (options?: {
        includeExtendedMetadata?: boolean;
        includeAttributeScores?: boolean;
        includeRatingFlags?: boolean;
      }) =>
        supabase
          .from("songwriting_projects")
          .insert(buildPayload(options) as any)
          .select()
          .single();

      let { data, error } = await attemptInsert();

      if (
        error &&
        songwritingEstimatedCompletionSupportedRef.current &&
        isMissingColumnError(error, "estimated_completion_sessions")
      ) {
        updateSchemaSupportRef(
          songwritingEstimatedCompletionSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
          false,
        );
        console.warn(
          "Songwriting projects estimated_completion_sessions column unavailable when creating; retrying without it.",
          error,
        );

        const fallback = await attemptInsert();
        data = fallback.data;
        error = fallback.error;
      }

      if (
        error &&
        songwritingProjectExtendedMetadataSupportedRef.current &&
        [
          "purpose",
          "mode",
          "genres",
          "co_writers",
          "co_writer_splits",
          "initial_production_potential",
          "production_potential",
        ].some((column) => isMissingColumnError(error, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectExtendedMetadataSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
          false,
        );
        console.warn(
          "Songwriting projects extended metadata columns unavailable when creating; retrying without them.",
          error,
        );

        const fallback = await attemptInsert({ includeExtendedMetadata: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (
        error &&
        songwritingProjectAttributeScoresSupportedRef.current &&
        (isMissingColumnError(error, "attribute_scores") ||
          SONG_ATTRIBUTE_KEYS.some((key) =>
            ATTRIBUTE_COLUMN_ALIASES[key].some((column) => isMissingColumnError(error, column)),
          ))
      ) {
        updateSchemaSupportRef(
          songwritingProjectAttributeScoresSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
          false,
        );
        console.warn(
          "Songwriting projects attribute_scores column unavailable when creating; retrying without it.",
          error,
        );

        const fallback = await attemptInsert({ includeAttributeScores: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (
        error &&
        songwritingProjectRatingFlagsSupportedRef.current &&
        [
          "rating_hidden",
          "rating_visible",
          "rating_revealed_at",
          "rating_revealed_stage",
          "rating_owner_user_id",
          "rating_owner_profile_id",
        ].some((column) => isMissingColumnError(error, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectRatingFlagsSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
          false,
        );
        console.warn(
          "Songwriting projects rating metadata columns unavailable when creating; retrying without them.",
          error,
        );

        const fallback = await attemptInsert({ includeRatingFlags: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error && songwritingSessionsCompletedSupportedRef.current && isMissingColumnError(error, "sessions_completed")) {
        updateSchemaSupportRef(
          songwritingSessionsCompletedSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
          false,
        );
        console.warn(
          "Songwriting projects sessions_completed column unavailable when creating; retrying without it.",
          error,
        );

        const fallback = await attemptInsert();
        data = fallback.data;
        error = fallback.error;
      }

      if (error && songwritingLyricsColumnSupportedRef.current && isMissingColumnError(error, "lyrics")) {
        updateSchemaSupportRef(
          songwritingLyricsColumnSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.lyrics,
          false,
        );
        console.warn(
          "Songwriting projects lyrics column unavailable when creating; retrying without it.",
          error,
        );

        const fallback = await attemptInsert();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        handleMissingSongwritingTableError(error);
        throw error;
      }

      const normalized = data
        ? (normalizeProjectRow(data as any) as any)
        : null;
      persistSongwritingSchemaSupport();
      return normalized as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Project Created",
        description: "Your songwriting project is ready for its first focus sprint!"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error && error.message.includes("unavailable")
            ? "Songwriting projects are not available yet. Please try again later."
            : "Failed to create songwriting project",
        variant: "destructive"
      });
      console.error("Create project error:", error);
    }
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProjectInput) => {
      if (!id) {
        throw new Error("Project id is required to update a songwriting project");
      }

      let sanitizedGenresUpdate: string[] | undefined;
      let sanitizedPurposeUpdate: string | null | undefined;
      let sanitizedModeUpdate: string | null | undefined;
      let sanitizedInitialProductionPotentialUpdate: number | null | undefined;
      let sanitizedProductionPotentialUpdate: number | null | undefined;
      let sanitizedCoWriterMetadata:
        | { coWriters: string[] | null; splits: number[] | null }
        | undefined;
      let sanitizedAttributeScoresUpdate: Partial<SongAttributeScores> | null | undefined;

      if (updates.genres !== undefined) {
        sanitizedGenresUpdate = sanitizeGenreSelection(updates.genres);

        try {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) {
            throw authError;
          }

          const userId = authData.user?.id;
          if (userId) {
            const { data: skillRow, error: skillError } = await supabase
              .from("player_skills")
              .select("guitar, bass, drums, vocals, songwriting")
              .eq("user_id", userId)
              .maybeSingle();

            if (skillError && skillError.code !== "PGRST116") {
              throw skillError;
            }

            validateGenreSelection(sanitizedGenresUpdate, skillRow ?? undefined);
          }
        } catch (validationError) {
          throw validationError;
        }
      }

      if (updates.purpose !== undefined) {
        sanitizedPurposeUpdate =
          typeof updates.purpose === "string" && updates.purpose.trim().length > 0
            ? updates.purpose.trim()
            : null;
      }

      if (updates.mode !== undefined) {
        sanitizedModeUpdate =
          typeof updates.mode === "string" && updates.mode.trim().length > 0
            ? updates.mode.trim()
            : null;
      }

      if (updates.initial_production_potential !== undefined) {
        const parsed = toNumberOrNull(updates.initial_production_potential);
        sanitizedInitialProductionPotentialUpdate =
          parsed === null ? null : clampNumber(parsed, 0, 100);
      }

      if (updates.production_potential !== undefined) {
        const parsed = toNumberOrNull(updates.production_potential);
        sanitizedProductionPotentialUpdate = parsed === null ? null : clampNumber(parsed, 0, 100);
      }

      if (updates.co_writers !== undefined || updates.co_writer_splits !== undefined) {
        sanitizedCoWriterMetadata = sanitizeCoWriterMetadata(
          updates.co_writers ?? null,
          updates.co_writer_splits ?? null,
        );
      }

      if (updates.attribute_scores !== undefined) {
        if (updates.attribute_scores === null) {
          sanitizedAttributeScoresUpdate = null;
        } else {
          const sanitized: Partial<SongAttributeScores> = {};
          SONG_ATTRIBUTE_KEYS.forEach((key) => {
            const candidate = updates.attribute_scores?.[key];
            if (candidate === undefined) {
              return;
            }
            const parsed = toNumberOrNull(candidate);
            if (parsed !== null) {
              sanitized[key] = clampNumber(parsed, 0, 200);
            }
          });
          sanitizedAttributeScoresUpdate = sanitized;
        }
      }

      const buildPayload = (
        includeEstimated: boolean,
        {
          includeExtendedMetadata = songwritingProjectExtendedMetadataSupportedRef.current,
          includeAttributeScores = songwritingProjectAttributeScoresSupportedRef.current,
          includeRatingFlags = songwritingProjectRatingFlagsSupportedRef.current,
        }: {
          includeExtendedMetadata?: boolean;
          includeAttributeScores?: boolean;
          includeRatingFlags?: boolean;
        } = {},
      ) => {
        const payload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        (Object.entries(updates) as Array<[keyof UpdateProjectInput, unknown]>).forEach(([key, value]) => {
          if (value === undefined) {
            return;
          }

          if (key === "estimated_completion_sessions") {
            if (includeEstimated) {
              payload[key] = value;
            }
            payload.estimated_sessions = value;
            return;
          }

          if (key === "lyrics") {
            if (songwritingLyricsColumnSupportedRef.current) {
              payload.lyrics = value;
            } else {
              payload.initial_lyrics = value;
            }
            return;
          }

          if (key === "genres") {
            if (includeExtendedMetadata && sanitizedGenresUpdate !== undefined) {
              payload.genres = sanitizedGenresUpdate;
            }
            return;
          }

          if (key === "purpose") {
            if (includeExtendedMetadata && sanitizedPurposeUpdate !== undefined) {
              payload.purpose = sanitizedPurposeUpdate;
            }
            return;
          }

          if (key === "mode") {
            if (includeExtendedMetadata && sanitizedModeUpdate !== undefined) {
              payload.mode = sanitizedModeUpdate;
            }
            return;
          }

          if (key === "co_writers" || key === "co_writer_splits") {
            if (includeExtendedMetadata && sanitizedCoWriterMetadata) {
              payload.co_writers = sanitizedCoWriterMetadata.coWriters ?? [];
              payload.co_writer_splits = sanitizedCoWriterMetadata.splits
                ? sanitizedCoWriterMetadata.splits
                : (sanitizedCoWriterMetadata.coWriters ?? []).map(() => 0);
            }
            return;
          }

          if (key === "initial_production_potential") {
            if (
              includeExtendedMetadata &&
              sanitizedInitialProductionPotentialUpdate !== undefined
            ) {
              payload.initial_production_potential = sanitizedInitialProductionPotentialUpdate;
            }
            return;
          }

          if (key === "production_potential") {
            if (includeExtendedMetadata && sanitizedProductionPotentialUpdate !== undefined) {
              payload.production_potential = sanitizedProductionPotentialUpdate;
            }
            return;
          }

          if (key === "attribute_scores") {
            if (includeAttributeScores && sanitizedAttributeScoresUpdate !== undefined) {
              if (sanitizedAttributeScoresUpdate === null) {
                payload.attribute_scores = null;
              } else {
                payload.attribute_scores = {
                  concept: sanitizedAttributeScoresUpdate.concept ?? 0,
                  lyrics: sanitizedAttributeScoresUpdate.lyrics ?? 0,
                  melody: sanitizedAttributeScoresUpdate.melody ?? 0,
                  production: sanitizedAttributeScoresUpdate.production ?? 0,
                  performance: sanitizedAttributeScoresUpdate.performance ?? 0,
                } satisfies SongAttributeScores;
              }
            }
            return;
          }

          payload[key] = value;
        });

        if (!includeEstimated) {
          delete payload.estimated_completion_sessions;
        }

        if (updates.estimated_completion_sessions !== undefined) {
          payload.estimated_sessions = updates.estimated_completion_sessions;
        }

        if (
          songwritingLyricsColumnSupportedRef.current &&
          payload.initial_lyrics !== undefined &&
          payload.lyrics === undefined
        ) {
          payload.lyrics = payload.initial_lyrics;
        }

        if (!songwritingLyricsColumnSupportedRef.current) {
          delete payload.lyrics;
        }

        if (!includeExtendedMetadata) {
          delete payload.purpose;
          delete payload.mode;
          delete payload.genres;
          delete payload.co_writers;
          delete payload.co_writer_splits;
          delete payload.initial_production_potential;
          delete payload.production_potential;
        }

        if (!includeAttributeScores) {
          delete payload.attribute_scores;
        }

        if (!includeRatingFlags) {
          delete payload.rating_hidden;
          delete payload.rating_visible;
          delete payload.rating_revealed_at;
          delete payload.rating_revealed_stage;
          delete payload.rating_owner_user_id;
          delete payload.rating_owner_profile_id;
        }

        return payload;
      };

      const attemptUpdate = (
        includeEstimated: boolean,
        options?: {
          includeExtendedMetadata?: boolean;
          includeAttributeScores?: boolean;
          includeRatingFlags?: boolean;
        },
      ) =>
        supabase
          .from("songwriting_projects")
          .update(buildPayload(includeEstimated, options) as Record<string, unknown>)
          .eq("id", id);

      let { error } = await attemptUpdate(songwritingEstimatedCompletionSupportedRef.current);

      if (
        error &&
        songwritingEstimatedCompletionSupportedRef.current &&
        isMissingColumnError(error, "estimated_completion_sessions")
      ) {
        updateSchemaSupportRef(
          songwritingEstimatedCompletionSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
          false,
        );
        console.warn(
          "Songwriting projects estimated_completion_sessions column unavailable when updating; retrying without it.",
          error,
        );

        ({ error } = await attemptUpdate(false));
      }

      if (error && songwritingSessionsCompletedSupportedRef.current && isMissingColumnError(error, "sessions_completed")) {
        updateSchemaSupportRef(
          songwritingSessionsCompletedSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
          false,
        );
        console.warn(
          "Songwriting projects sessions_completed column unavailable when updating; retrying without it.",
          error,
        );

        ({ error } = await attemptUpdate(songwritingEstimatedCompletionSupportedRef.current));
      }

      if (error && songwritingLyricsColumnSupportedRef.current && isMissingColumnError(error, "lyrics")) {
        updateSchemaSupportRef(
          songwritingLyricsColumnSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.lyrics,
          false,
        );
        console.warn(
          "Songwriting projects lyrics column unavailable when updating; retrying without it.",
          error,
        );

        ({ error } = await attemptUpdate(songwritingEstimatedCompletionSupportedRef.current));
      }

      if (
        error &&
        songwritingProjectExtendedMetadataSupportedRef.current &&
        [
          "purpose",
          "mode",
          "genres",
          "co_writers",
          "co_writer_splits",
          "initial_production_potential",
          "production_potential",
        ].some((column) => isMissingColumnError(error, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectExtendedMetadataSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
          false,
        );
        console.warn(
          "Songwriting projects extended metadata columns unavailable when updating; retrying without them.",
          error,
        );

        ({ error } = await attemptUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeExtendedMetadata: false },
        ));
      }

      if (
        error &&
        songwritingProjectAttributeScoresSupportedRef.current &&
        (isMissingColumnError(error, "attribute_scores") ||
          SONG_ATTRIBUTE_KEYS.some((key) =>
            ATTRIBUTE_COLUMN_ALIASES[key].some((column) => isMissingColumnError(error, column)),
          ))
      ) {
        updateSchemaSupportRef(
          songwritingProjectAttributeScoresSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
          false,
        );
        console.warn(
          "Songwriting projects attribute_scores column unavailable when updating; retrying without it.",
          error,
        );

        ({ error } = await attemptUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeAttributeScores: false },
        ));
      }

      if (
        error &&
        songwritingProjectRatingFlagsSupportedRef.current &&
        [
          "rating_hidden",
          "rating_visible",
          "rating_revealed_at",
          "rating_revealed_stage",
          "rating_owner_user_id",
          "rating_owner_profile_id",
        ].some((column) => isMissingColumnError(error, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectRatingFlagsSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
          false,
        );
        console.warn(
          "Songwriting projects rating metadata columns unavailable when updating; retrying without them.",
          error,
        );

        ({ error } = await attemptUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeRatingFlags: false },
        ));
      }

      if (error) throw error;
      persistSongwritingSchemaSupport();
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Project Updated",
        description: "Your songwriting roadmap has been refreshed."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update songwriting project",
        variant: "destructive"
      });
      console.error("Update project error:", error);
    }
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from("songwriting_projects")
        .delete()
        .eq("id", projectId);

      if (error) throw error;
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Project Deleted",
        description: "The songwriting project has been removed."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete songwriting project",
        variant: "destructive"
      });
      console.error("Delete project error:", error);
    }
  });

  const startSession = useMutation({
    mutationFn: async ({ projectId, effortHours, resumeSessionId }: StartSessionInput) => {
      if (!projectId) {
        throw new Error("Project id is required to start a songwriting session");
      }

      const sanitizedEffortHours = sanitizeEffortHours(effortHours);
      const sessionDurationMinutes = sanitizedEffortHours * 60;
      const lockDurationMinutes = Math.max(30, sanitizedEffortHours * 10);

      const { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select("is_locked, locked_until, status")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) throw new Error("Project not found");

      if (!resumeSessionId && project.is_locked && project.locked_until) {
        const lockTime = new Date(project.locked_until);
        if (!Number.isNaN(lockTime.getTime()) && lockTime > new Date()) {
          throw new Error("Project is currently locked. Please wait before starting a new session.");
        }
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("User must be signed in to start a songwriting session.");
      }

      const startedAt = new Date();
      const lockUntil = new Date(startedAt.getTime() + lockDurationMinutes * 60 * 1000);

      const { error: lockError } = await supabase
        .from("songwriting_projects")
        .update({
          is_locked: true,
          locked_until: lockUntil.toISOString(),
          status: project.status && project.status !== "draft" ? project.status : "writing",
          updated_at: startedAt.toISOString(),
        } as Record<string, unknown>)
        .eq("id", projectId);

      if (lockError) throw lockError;

      if (resumeSessionId) {
        const { data: existingSession, error: existingSessionError } = await supabase
          .from("songwriting_sessions")
          .select(
            [
              "id",
              "project_id",
              "user_id",
              "session_start",
              "locked_until",
              songwritingSessionExtendedTrackingSupportedRef.current ? "pause_state" : null,
            ]
              .filter((field): field is string => typeof field === "string" && field.length > 0)
              .join(","),
          )
          .eq("id", resumeSessionId)
          .maybeSingle();

        if (existingSessionError) {
          throw existingSessionError;
        }

        if (!existingSession || existingSession.project_id !== projectId) {
          throw new Error("Unable to resume session: session not found or does not match project.");
        }

        const resumePayload: Record<string, unknown> = {
          locked_until: lockUntil.toISOString(),
        };

        if (songwritingSessionExtendedTrackingSupportedRef.current) {
          resumePayload.effort_hours = sanitizedEffortHours;
          resumePayload.duration_minutes = sessionDurationMinutes;
          resumePayload.pause_state = "active";
          resumePayload.resumed_at = startedAt.toISOString();
        }

        const { data: resumedData, error: resumeError } = await supabase
          .from("songwriting_sessions")
          .update(resumePayload)
          .eq("id", resumeSessionId)
          .select()
          .single();

        if (
          resumeError &&
          songwritingSessionExtendedTrackingSupportedRef.current &&
          [
            "effort_hours",
            "duration_minutes",
            "pause_state",
            "resumed_at",
          ].some((column) => isMissingColumnError(resumeError, column))
        ) {
          updateSchemaSupportRef(
            songwritingSessionExtendedTrackingSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.sessionExtendedTracking,
            false,
          );
          console.warn(
            "Songwriting session extended tracking columns unavailable when resuming; retrying without them.",
            resumeError,
          );

          const { data: fallbackData, error: fallbackResumeError } = await supabase
            .from("songwriting_sessions")
            .update({ locked_until: lockUntil.toISOString() })
            .eq("id", resumeSessionId)
            .select()
            .single();

          if (fallbackResumeError) {
            throw fallbackResumeError;
          }

          return fallbackData as SongwritingSession;
        }

        if (resumeError) {
          throw resumeError;
        }

        return resumedData as SongwritingSession;
      }

      const { data, error } = await supabase
        .from("songwriting_sessions")
        .insert({
          project_id: projectId,
          user_id: userId,
          session_start: startedAt.toISOString(),
          ...(songwritingSessionsStartedAtSupportedRef.current
            ? { started_at: startedAt.toISOString() }
            : {}),
          locked_until: lockUntil.toISOString(),
          notes: null,
          ...(songwritingSessionExtendedTrackingSupportedRef.current
            ? {
                effort_hours: sanitizedEffortHours,
                duration_minutes: sessionDurationMinutes,
                pause_state: "active",
              }
            : {}),
        } as any)
        .select()
        .single();

      if (error) {
        if (songwritingSessionsStartedAtSupportedRef.current && isMissingColumnError(error, "started_at")) {
          updateSchemaSupportRef(
            songwritingSessionsStartedAtSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.sessionsStartedAt,
            false,
          );
          console.warn(
            "Songwriting sessions started_at column unavailable when creating a session; retrying without it.",
            error,
          );

          const { data: legacyData, error: legacyError } = await supabase
            .from("songwriting_sessions")
            .insert({
              project_id: projectId,
              user_id: userId,
              session_start: startedAt.toISOString(),
              locked_until: lockUntil.toISOString(),
              notes: null,
            } as any)
            .select()
            .single();

          if (legacyError) {
            throw legacyError;
          }

          return legacyData as SongwritingSession;
        }

        if (
          songwritingSessionExtendedTrackingSupportedRef.current &&
          ["effort_hours", "duration_minutes", "pause_state"].some((column) =>
            isMissingColumnError(error, column),
          )
        ) {
          updateSchemaSupportRef(
            songwritingSessionExtendedTrackingSupportedRef,
            SONGWRITING_SCHEMA_FEATURES.sessionExtendedTracking,
            false,
          );
          console.warn(
            "Songwriting sessions extended tracking columns unavailable when creating a session; retrying without them.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await supabase
            .from("songwriting_sessions")
            .insert({
              project_id: projectId,
              user_id: userId,
              session_start: startedAt.toISOString(),
              ...(songwritingSessionsStartedAtSupportedRef.current
                ? { started_at: startedAt.toISOString() }
                : {}),
              locked_until: lockUntil.toISOString(),
              notes: null,
            } as any)
            .select()
            .single();

          if (fallbackError) {
            throw fallbackError;
          }

          return fallbackData as SongwritingSession;
        }

        throw error;
      }
      return data as SongwritingSession;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      const hours = sanitizeEffortHours(variables?.effortHours ?? DEFAULT_SESSION_HOURS);
      const resumed = Boolean(variables?.resumeSessionId);
      toast({
        title: "Session Started",
        description: resumed
          ? `Resumed a ${hours}-hour songwriting sprint. Finish strong!`
          : `Your ${hours}-hour songwriting focus session has begun! Stay locked in.`,
      });
    },
    onError: (error) => {
      const description =
        error instanceof Error ? error.message : "Failed to start songwriting session";
      toast({
        title: "Error",
        description,
        variant: "destructive"
      });
    }
  });

  const completeSession = useMutation({
    mutationFn: async ({
      sessionId,
      notes,
      effortHours,
      paused,
      resumeAt,
      coWriterAdjustments,
    }: CompleteSessionInput) => {
      const sessionSelect = [
        "project_id",
        "user_id",
        songwritingSessionExtendedTrackingSupportedRef.current ? "effort_hours" : null,
        songwritingSessionExtendedTrackingSupportedRef.current ? "duration_minutes" : null,
        songwritingSessionExtendedTrackingSupportedRef.current ? "pause_state" : null,
        songwritingSessionExtendedTrackingSupportedRef.current ? "co_writer_contributions" : null,
        songwritingSessionExtendedTrackingSupportedRef.current ? "royalty_split_snapshot" : null,
      ]
        .filter((field): field is string => typeof field === "string" && field.length > 0)
        .join(",");

      const { data: session, error: sessionError } = await supabase
        .from("songwriting_sessions")
        .select(sessionSelect)
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("Session not found");

      const inferredEffortHours = songwritingSessionExtendedTrackingSupportedRef.current
        ? toNumberOrNull((session as Record<string, unknown>).effort_hours) ?? undefined
        : undefined;
      const sanitizedEffortHours = sanitizeEffortHours(effortHours ?? inferredEffortHours);
      const sessionDurationMinutes = sanitizedEffortHours * 60;

      const buildProjectSelect = (includeEstimated: boolean) =>
        [
          "music_progress",
          "lyrics_progress",
          "total_sessions",
          includeEstimated ? "estimated_completion_sessions" : null,
          "estimated_sessions",
          "quality_score",
          "status",
          songwritingSessionsCompletedSupportedRef.current ? "sessions_completed" : null,
          "theme_id",
          "chord_progression_id",
          songwritingProjectExtendedMetadataSupportedRef.current ? "purpose" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "mode" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "genres" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writers" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writer_splits" : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "initial_production_potential"
            : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "production_potential" : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "production_potential_revealed"
            : null,
          songwritingProjectExtendedMetadataSupportedRef.current
            ? "production_potential_revealed_at"
            : null,
          songwritingProjectAttributeScoresSupportedRef.current ? "attribute_scores" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writer_contributions" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_hidden" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_visible" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_revealed_at" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_revealed_stage" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_user_id" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_profile_id" : null,
        ]
          .filter((field): field is string => typeof field === "string" && field.length > 0)
          .join(", ");

      const includeEstimatedCompletion = songwritingEstimatedCompletionSupportedRef.current;

      let { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select(buildProjectSelect(includeEstimatedCompletion))
        .eq("id", session.project_id)
        .maybeSingle();

      if (
        projectError &&
        includeEstimatedCompletion &&
        isMissingColumnError(projectError, "estimated_completion_sessions")
      ) {
        updateSchemaSupportRef(
          songwritingEstimatedCompletionSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
          false,
        );
        console.warn(
          "Songwriting projects estimated_completion_sessions column unavailable when completing session; retrying without it.",
          projectError,
        );

        const fallback = await supabase
          .from("songwriting_projects")
          .select(buildProjectSelect(false))
          .eq("id", session.project_id)
          .maybeSingle();

        project = fallback.data;
        projectError = fallback.error;
      }

      if (
        projectError &&
        songwritingSessionsCompletedSupportedRef.current &&
        isMissingColumnError(projectError, "sessions_completed")
      ) {
        updateSchemaSupportRef(
          songwritingSessionsCompletedSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
          false,
        );
        console.warn(
          "Songwriting projects sessions_completed column unavailable when completing session fetch; retrying without it.",
          projectError,
        );

        const fallback = await supabase
          .from("songwriting_projects")
          .select(buildProjectSelect(songwritingEstimatedCompletionSupportedRef.current))
          .eq("id", session.project_id)
          .maybeSingle();

        project = fallback.data;
        projectError = fallback.error;
      }

      if (projectError) throw projectError;
      if (!project) throw new Error("Project not found");

      const normalizedProject = normalizeProjectRow(project as any) as any;

      const [
        { data: skills, error: skillsError },
        { data: attributes, error: attributesError },
        { data: profile, error: profileError },
      ] = await Promise.all([
        supabase
          .from("player_skills")
          .select("songwriting, creativity, composition")
          .eq("user_id", session.user_id)
          .maybeSingle(),
        supabase
          .from("player_attributes")
          .select("creative_insight, musical_ability, mental_focus, physical_endurance")
          .eq("user_id", session.user_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("level, fame, weekly_bonus_metadata")
          .eq("user_id", session.user_id)
          .maybeSingle(),
      ]);

      if (skillsError && skillsError.code !== "PGRST116") {
        throw skillsError;
      }

      if (attributesError && attributesError.code !== "PGRST116") {
        throw attributesError;
      }

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      let moodModifier = computeAttributeModifier(attributes?.mental_focus ?? null);
      let healthModifier = computeAttributeModifier(attributes?.physical_endurance ?? null);
      let inspirationModifier = computeAttributeModifier(attributes?.creative_insight ?? null, 50, 200);

      const profileLevel = toNumberOrNull(profile?.level) ?? 0;
      const profileFame = toNumberOrNull(profile?.fame) ?? 0;
      if (profileLevel > 0) {
        moodModifier = clampNumber(moodModifier * (1 + profileLevel / 500), 0.7, 1.5);
      }
      if (profileFame > 0) {
        inspirationModifier = clampNumber(inspirationModifier * (1 + profileFame / 12000), 0.7, 1.5);
      }

      const progressParameters: Record<string, unknown> = {
        p_skill_songwriting: skills?.songwriting || 1,
        p_skill_creativity: skills?.creativity || 1,
        p_skill_composition: skills?.composition || 1,
        p_attr_creative_insight: attributes?.creative_insight || 10,
        p_attr_musical_ability: attributes?.musical_ability || 10,
        p_current_music: normalizedProject.music_progress ?? 0,
        p_current_lyrics: normalizedProject.lyrics_progress ?? 0,
        p_effort_hours: sanitizedEffortHours,
        p_mood_modifier: moodModifier,
        p_health_modifier: healthModifier,
        p_inspiration_modifier: inspirationModifier,
        p_session_paused: Boolean(paused),
      };

      const { data: progressCalc, error: calcError } = await supabase.rpc(
        "calculate_songwriting_progress",
        progressParameters as any,
      );

      if (calcError) throw calcError;

      const progressResult = (progressCalc ?? {}) as Record<string, unknown>;
      const coerceNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

      const musicGain = coerceNumber(progressResult.music_gain);
      const lyricsGain = coerceNumber(progressResult.lyrics_gain);
      const xpEarned = coerceNumber(progressResult.xp_earned);

      const attributeGainsRaw = progressResult.attribute_gains;
      const parsedAttributeGains: Partial<SongAttributeScores> = {};
      if (attributeGainsRaw && typeof attributeGainsRaw === "object" && !Array.isArray(attributeGainsRaw)) {
        SONG_ATTRIBUTE_KEYS.forEach((key) => {
          const parsed = toNumberOrNull((attributeGainsRaw as Record<string, unknown>)[key]);
          if (parsed !== null) {
            parsedAttributeGains[key] = parsed;
          }
        });
      }

      const adjustedAttributeGains: SongAttributeScores = {
        concept: 0,
        lyrics: 0,
        melody: 0,
        production: 0,
        performance: 0,
      };

      SONG_ATTRIBUTE_KEYS.forEach((key) => {
        let baseGain = parsedAttributeGains[key] ?? 0;
        if (MOOD_INFLUENCED_ATTRIBUTES.includes(key)) {
          baseGain *= moodModifier;
        }
        if (HEALTH_INFLUENCED_ATTRIBUTES.includes(key)) {
          baseGain *= healthModifier;
        }
        if (INSPIRATION_INFLUENCED_ATTRIBUTES.includes(key)) {
          baseGain *= inspirationModifier;
        }
        adjustedAttributeGains[key] = Math.round(baseGain);
      });

      const completedAt = new Date();

      const sessionUpdatePayload: Record<string, unknown> = {
        session_end: completedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        locked_until: null,
        music_progress_gained: musicGain,
        lyrics_progress_gained: lyricsGain,
        xp_earned: xpEarned,
        notes: notes?.trim() ? notes.trim() : null,
      };

      const normalizedSession = session as Record<string, unknown>;

      const computeCoWriterSnapshots = () => {
        const coWriterIds = Array.isArray(normalizedProject.co_writers)
          ? (normalizedProject.co_writers as string[])
          : [];
        const coWriterSplits = Array.isArray(normalizedProject.co_writer_splits)
          ? (normalizedProject.co_writer_splits as number[])
          : [];
        const ownerUserId = typeof normalizedProject.user_id === "string" ? normalizedProject.user_id : session.user_id;

        if (coWriterIds.length === 0) {
          return { contributions: null as Record<string, number> | null, splits: null as Record<string, number> | null };
        }

        const contributions: Record<string, number> = {};
        const splitsSnapshot: Record<string, number> = {};
        const totalSplit = coWriterSplits.reduce((total, value) => total + value, 0);
        const ownerSplit = clampNumber(100 - totalSplit, 0, 100);
        const gainBase = Math.max(0, musicGain + lyricsGain);
        const contributionUnit = gainBase / 100;

        coWriterIds.forEach((coWriterId, index) => {
          const split = clampNumber(toNumberOrNull(coWriterSplits[index]) ?? 0, 0, 100);
          const adjustment = coWriterAdjustments?.[coWriterId] ?? 0;
          contributions[coWriterId] = Math.round(split * contributionUnit + adjustment);
          splitsSnapshot[coWriterId] = split;
        });

        const ownerAdjustment = coWriterAdjustments?.[ownerUserId] ?? 0;
        contributions[ownerUserId] = Math.round(ownerSplit * contributionUnit + ownerAdjustment);
        splitsSnapshot[ownerUserId] = ownerSplit;

        return { contributions, splits: splitsSnapshot };
      };

      let coWriterSnapshots: { contributions: Record<string, number> | null; splits: Record<string, number> | null } =
        { contributions: null, splits: null };

      if (songwritingSessionExtendedTrackingSupportedRef.current) {
        sessionUpdatePayload.effort_hours = sanitizedEffortHours;
        sessionUpdatePayload.duration_minutes = sessionDurationMinutes;
        sessionUpdatePayload.pause_state = paused ? "paused" : "completed";
        sessionUpdatePayload.attribute_gains = adjustedAttributeGains;
        sessionUpdatePayload.mood_modifier = moodModifier;
        sessionUpdatePayload.health_modifier = healthModifier;
        sessionUpdatePayload.inspiration_modifier = inspirationModifier;

        coWriterSnapshots = computeCoWriterSnapshots();
        sessionUpdatePayload.co_writer_contributions = coWriterSnapshots.contributions;
        sessionUpdatePayload.royalty_split_snapshot = coWriterSnapshots.splits;
      }

      const { error: updateSessionError } = await supabase
        .from("songwriting_sessions")
        .update(sessionUpdatePayload)
        .eq("id", sessionId);

      if (
        updateSessionError &&
        songwritingSessionExtendedTrackingSupportedRef.current &&
        [
          "effort_hours",
          "duration_minutes",
          "pause_state",
          "attribute_gains",
          "mood_modifier",
          "health_modifier",
          "inspiration_modifier",
          "co_writer_contributions",
          "royalty_split_snapshot",
        ].some((column) => isMissingColumnError(updateSessionError, column))
      ) {
        updateSchemaSupportRef(
          songwritingSessionExtendedTrackingSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.sessionExtendedTracking,
          false,
        );
        console.warn(
          "Songwriting sessions extended tracking columns unavailable when completing; retrying without them.",
          updateSessionError,
        );

        const { error: fallbackSessionError } = await supabase
          .from("songwriting_sessions")
          .update({
            session_end: completedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            locked_until: null,
            music_progress_gained: musicGain,
            lyrics_progress_gained: lyricsGain,
            xp_earned: xpEarned,
            notes: notes?.trim() ? notes.trim() : null,
          })
          .eq("id", sessionId);

        if (fallbackSessionError) {
          throw fallbackSessionError;
        }
      } else if (updateSessionError) {
        throw updateSessionError;
      }

      const maxProgress = 2000;
      const currentMusic = normalizedProject.music_progress ?? 0;
      const currentLyrics = normalizedProject.lyrics_progress ?? 0;
      const newMusicProgress = Math.min(maxProgress, currentMusic + musicGain);
      const newLyricsProgress = Math.min(maxProgress, currentLyrics + lyricsGain);
      const isComplete = newMusicProgress >= maxProgress && newLyricsProgress >= maxProgress;

      const newTotalSessions = (normalizedProject.total_sessions ?? 0) + 1;
      const previousSessionsCompleted =
        typeof normalizedProject.sessions_completed === "number" &&
        Number.isFinite(normalizedProject.sessions_completed)
          ? normalizedProject.sessions_completed
          : Math.max(0, normalizedProject.total_sessions ?? 0);
      const newSessionsCompleted = previousSessionsCompleted + 1;
      const targetSessions =
        normalizedProject.estimated_completion_sessions ??
        normalizedProject.estimated_sessions ??
        Math.max(newTotalSessions, 3);
      const completionRatio = targetSessions > 0 ? newTotalSessions / targetSessions : 0;

      let nextStatus = normalizedProject.status ?? "draft";
      if (isComplete) {
        nextStatus = "completed";
      } else if (completionRatio >= 1) {
        nextStatus = "ready_to_finish";
      } else if (completionRatio >= 0.7) {
        nextStatus = "arranging";
      } else if (nextStatus === "draft") {
        nextStatus = "writing";
      }

      const skillAverage =
        ((skills?.songwriting ?? 1) + (skills?.creativity ?? 1) + (skills?.composition ?? 1)) / 3;
      const attributeAverage =
        ((attributes?.creative_insight ?? 10) + (attributes?.musical_ability ?? 10)) / 2;
      const progressRatio = (newMusicProgress + newLyricsProgress) / (maxProgress * 2);
      const efficiencyRatio = targetSessions > 0 ? newTotalSessions / targetSessions : 1;
      const efficiencyModifier =
        efficiencyRatio > 1
          ? Math.max(0.85, 1.05 - (efficiencyRatio - 1) * 0.1)
          : 1 + Math.min(0.1, (1 - efficiencyRatio) * 0.2);
      const consistencyModifier =
        1 + Math.min(0.12, newSessionsCompleted / Math.max(newTotalSessions, 1) * 0.06);
      const themeModifier =
        1 + (normalizedProject.theme_id ? 0.04 : 0) + (normalizedProject.chord_progression_id ? 0.04 : 0);

      const progressComponent = 0.45 * Math.min(1, progressRatio);
      const skillComponent = 0.35 * Math.min(1, skillAverage / 120);
      const attributeComponent = 0.2 * Math.min(1, attributeAverage / 140);

      let computedQuality = Math.round(
        2000 *
          (progressComponent + skillComponent + attributeComponent) *
          efficiencyModifier *
          consistencyModifier *
          themeModifier,
      );
      computedQuality = Math.min(2000, Math.max(normalizedProject.quality_score ?? 0, computedQuality));
      const qualityDescriptor = getSongQualityDescriptor(computedQuality);

      const baseAttributeScores = extractAttributeScores(normalizedProject);
      const updatedAttributeScores: SongAttributeScores = { ...baseAttributeScores };
      SONG_ATTRIBUTE_KEYS.forEach((key) => {
        updatedAttributeScores[key] = clampNumber(
          (baseAttributeScores[key] ?? 0) + (adjustedAttributeGains[key] ?? 0),
          0,
          200,
        );
      });

      const computedSongRating = computeSongRatingFromScores(updatedAttributeScores);
      const ratingShouldReveal = shouldRevealSongRating(nextStatus);
      const previousRatingVisible = Boolean(normalizedProject.rating_visible);
      const ratingVisible = ratingShouldReveal || previousRatingVisible;
      const ratingHidden = !ratingVisible;
      const previousRevealedAt =
        typeof normalizedProject.rating_revealed_at === "string"
          ? normalizedProject.rating_revealed_at
          : null;
      const ratingRevealedAt = ratingVisible
        ? previousRevealedAt ?? completedAt.toISOString()
        : null;
      const ratingRevealedStage = ratingVisible
        ? normalizedProject.rating_revealed_stage ?? nextStatus
        : null;
      const ratingOwnerUserId =
        normalizedProject.rating_owner_user_id ?? normalizedProject.user_id ?? session.user_id;

      const currentProductionPotential =
        toNumberOrNull(normalizedProject.production_potential) ??
        toNumberOrNull(normalizedProject.initial_production_potential) ??
        0;
      const productionPotentialGain = Math.round((musicGain + lyricsGain) / 45);
      const nextProductionPotential = clampNumber(
        currentProductionPotential + productionPotentialGain,
        0,
        100,
      );
      const productionPotentialRevealed =
        normalizedProject.production_potential_revealed || nextStatus !== "draft";
      const productionPotentialRevealedAt = productionPotentialRevealed
        ? normalizedProject.production_potential_revealed_at ?? completedAt.toISOString()
        : normalizedProject.production_potential_revealed_at ?? null;

      let updatedProjectContributions: Record<string, number> | null = null;
      if (coWriterSnapshots.contributions) {
        const existing =
          (normalizedProject.co_writer_contributions as Record<string, number> | null) ?? {};
        updatedProjectContributions = { ...existing };
        Object.entries(coWriterSnapshots.contributions).forEach(([coWriterId, contribution]) => {
          const previous = toNumberOrNull(updatedProjectContributions?.[coWriterId]) ?? 0;
          updatedProjectContributions![coWriterId] = previous + contribution;
        });
      }

      const buildUpdatePayload = (
        includeEstimated: boolean,
        {
          includeExtendedMetadata = songwritingProjectExtendedMetadataSupportedRef.current,
          includeAttributeScores = songwritingProjectAttributeScoresSupportedRef.current,
          includeRatingFlags = songwritingProjectRatingFlagsSupportedRef.current,
        }: {
          includeExtendedMetadata?: boolean;
          includeAttributeScores?: boolean;
          includeRatingFlags?: boolean;
        } = {},
      ) => {
        const payload: Record<string, unknown> = {
          music_progress: newMusicProgress,
          lyrics_progress: newLyricsProgress,
          total_sessions: newTotalSessions,
          ...(songwritingSessionsCompletedSupportedRef.current
            ? { sessions_completed: newSessionsCompleted }
            : {}),
          ...(includeEstimated ? { estimated_completion_sessions: targetSessions } : {}),
          estimated_sessions: targetSessions,
          status: nextStatus,
          is_locked: false,
          locked_until: null,
          quality_score: computedQuality,
          updated_at: completedAt.toISOString(),
        };

        if (includeExtendedMetadata) {
          payload.production_potential = nextProductionPotential;
          payload.production_potential_revealed = productionPotentialRevealed;
          payload.production_potential_revealed_at = productionPotentialRevealedAt;
          if (updatedProjectContributions) {
            payload.co_writer_contributions = updatedProjectContributions;
          }
        }

        if (includeAttributeScores) {
          payload.attribute_scores = updatedAttributeScores;
        }

        if (includeRatingFlags) {
          payload.rating_hidden = ratingHidden;
          payload.rating_visible = ratingVisible;
          payload.rating_revealed_at = ratingRevealedAt;
          payload.rating_revealed_stage = ratingRevealedStage;
          payload.rating_owner_user_id = ratingOwnerUserId;
          payload.rating_owner_profile_id = normalizedProject.rating_owner_profile_id ?? null;
        }

        return payload;
      };

      const attemptProjectUpdate = (
        includeEstimated: boolean,
        options?: {
          includeExtendedMetadata?: boolean;
          includeAttributeScores?: boolean;
          includeRatingFlags?: boolean;
        },
      ) =>
        supabase
          .from("songwriting_projects")
          .update(buildUpdatePayload(includeEstimated, options) as Record<string, unknown>)
          .eq("id", session.project_id);

      let { error: updateProjectError } = await attemptProjectUpdate(
        songwritingEstimatedCompletionSupportedRef.current,
      );

      if (
        updateProjectError &&
        songwritingEstimatedCompletionSupportedRef.current &&
        isMissingColumnError(updateProjectError, "estimated_completion_sessions")
      ) {
        updateSchemaSupportRef(
          songwritingEstimatedCompletionSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
          false,
        );
        console.warn(
          "Songwriting projects estimated_completion_sessions column unavailable when updating after session; retrying without it.",
          updateProjectError,
        );

        ({ error: updateProjectError } = await attemptProjectUpdate(false));
      }

      if (
        updateProjectError &&
        songwritingSessionsCompletedSupportedRef.current &&
        isMissingColumnError(updateProjectError, "sessions_completed")
      ) {
        updateSchemaSupportRef(
          songwritingSessionsCompletedSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.sessionsCompleted,
          false,
        );
        console.warn(
          "Songwriting projects sessions_completed column unavailable when completing a session; retrying without it.",
          updateProjectError,
        );

        ({ error: updateProjectError } = await attemptProjectUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
        ));
      }

      if (
        updateProjectError &&
        songwritingProjectExtendedMetadataSupportedRef.current &&
        [
          "production_potential",
          "production_potential_revealed",
          "production_potential_revealed_at",
          "co_writer_contributions",
        ].some((column) => isMissingColumnError(updateProjectError, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectExtendedMetadataSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
          false,
        );
        console.warn(
          "Songwriting projects extended metadata columns unavailable when updating after session; retrying without them.",
          updateProjectError,
        );

        ({ error: updateProjectError } = await attemptProjectUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeExtendedMetadata: false },
        ));
      }

      if (
        updateProjectError &&
        songwritingProjectAttributeScoresSupportedRef.current &&
        (isMissingColumnError(updateProjectError, "attribute_scores") ||
          SONG_ATTRIBUTE_KEYS.some((key) =>
            ATTRIBUTE_COLUMN_ALIASES[key].some((column) => isMissingColumnError(updateProjectError, column)),
          ))
      ) {
        updateSchemaSupportRef(
          songwritingProjectAttributeScoresSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
          false,
        );
        console.warn(
          "Songwriting projects attribute_scores column unavailable when updating after session; retrying without it.",
          updateProjectError,
        );

        ({ error: updateProjectError } = await attemptProjectUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeAttributeScores: false },
        ));
      }

      if (
        updateProjectError &&
        songwritingProjectRatingFlagsSupportedRef.current &&
        [
          "rating_hidden",
          "rating_visible",
          "rating_revealed_at",
          "rating_revealed_stage",
          "rating_owner_user_id",
          "rating_owner_profile_id",
        ].some((column) => isMissingColumnError(updateProjectError, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectRatingFlagsSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
          false,
        );
        console.warn(
          "Songwriting projects rating metadata columns unavailable when updating after session; retrying without them.",
          updateProjectError,
        );

        ({ error: updateProjectError } = await attemptProjectUpdate(
          songwritingEstimatedCompletionSupportedRef.current,
          { includeRatingFlags: false },
        ));
      }

      if (updateProjectError) throw updateProjectError;

      persistSongwritingSchemaSupport();

      return {
        musicGain,
        lyricsGain,
        xpEarned,
        isComplete,
        newMusicProgress,
        newLyricsProgress,
        qualityScore: computedQuality,
        qualityDescriptor,
        songRating: computedSongRating,
        ratingVisible,
        attributeGains: adjustedAttributeGains,
        moodModifier,
        healthModifier,
        inspirationModifier,
        effortHours: sanitizedEffortHours,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });

      const attributeSummary = SONG_ATTRIBUTE_KEYS.map((key) => {
        const gain = result.attributeGains?.[key] ?? 0;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return `${label} +${gain}`;
      }).join(", ");

      const ratingDescription = result.ratingVisible
        ? `Song rating ${result.songRating ?? 0}/1000 revealed.`
        : "Song rating still hidden until rehearsal or recording.";

      if (result.isComplete) {
        toast({
          title: "Song Completed!",
          description: `Your project hit 100% on both tracks. Quality locked at ${result.qualityDescriptor.label}. ${ratingDescription}`
        });
      } else {
        toast({
          title: "Session Complete",
          description: `Progress made! Music +${result.musicGain}, Lyrics +${result.lyricsGain}, XP +${result.xpEarned}. Quality now ${result.qualityDescriptor.label}. ${ratingDescription} Attribute gains: ${attributeSummary}.`
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete session",
        variant: "destructive"
      });
      console.error("Complete session error:", error);
    }
  });

  const convertToSong = useMutation({
    mutationFn: async (projectId: string) => {
      const buildProjectSelect = () => {
        const fields = [
          "id",
          "user_id",
          "title",
          "theme_id",
          "chord_progression_id",
          "initial_lyrics",
          songwritingLyricsColumnSupportedRef.current ? "lyrics" : null,
          "music_progress",
          "lyrics_progress",
          songwritingEstimatedCompletionSupportedRef.current
            ? "estimated_completion_sessions"
            : null,
          "estimated_sessions",
          "total_sessions",
          "quality_score",
          "status",
          "song_id",
          songwritingProjectExtendedMetadataSupportedRef.current ? "genres" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writers" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writer_splits" : null,
          songwritingProjectAttributeScoresSupportedRef.current ? "attribute_scores" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_hidden" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_visible" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_revealed_at" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_user_id" : null,
          songwritingProjectRatingFlagsSupportedRef.current ? "rating_owner_profile_id" : null,
          songwritingProjectExtendedMetadataSupportedRef.current ? "co_writer_contributions" : null,
        ].filter((field): field is string => typeof field === "string" && field.length > 0);

        return [
          fields.join(","),
          "song_themes (name)",
          "chord_progressions (name, progression)",
        ].join(",");
      };

      const attemptProjectFetch = () =>
        supabase
          .from("songwriting_projects")
          .select(buildProjectSelect())
          .eq("id", projectId)
          .single();

      let { data: project, error: projectError } = await attemptProjectFetch();

      if (
        projectError &&
        songwritingEstimatedCompletionSupportedRef.current &&
        isMissingColumnError(projectError, "estimated_completion_sessions")
      ) {
        updateSchemaSupportRef(
          songwritingEstimatedCompletionSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.estimatedCompletion,
          false,
        );
        console.warn(
          "Songwriting projects estimated_completion_sessions column unavailable when converting; retrying without it.",
          projectError,
        );

        ({ data: project, error: projectError } = await attemptProjectFetch());
      }

      if (projectError && songwritingLyricsColumnSupportedRef.current && isMissingColumnError(projectError, "lyrics")) {
        updateSchemaSupportRef(
          songwritingLyricsColumnSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.lyrics,
          false,
        );
        console.warn(
          "Songwriting projects lyrics column unavailable when converting; retrying without it.",
          projectError,
        );

        ({ data: project, error: projectError } = await attemptProjectFetch());
      }

      if (projectError) throw projectError;

      const normalizedProject = normalizeProjectRow(project as any) as any;
      const qualityDescriptor = getSongQualityDescriptor(normalizedProject.quality_score ?? 0);
      const estimatedSessions =
        normalizedProject.estimated_completion_sessions ??
        normalizedProject.estimated_sessions ??
        normalizedProject.total_sessions ?? 0;

      const primaryGenre = Array.isArray(normalizedProject.genres) && normalizedProject.genres.length > 0
        ? normalizedProject.genres[0]
        : normalizedProject.song_themes?.name || "Unknown";

      const buildSongPayload = ({
        includeExtendedMetadata = songwritingProjectExtendedMetadataSupportedRef.current,
        includeAttributeScores = songwritingProjectAttributeScoresSupportedRef.current,
        includeRatingFlags = songwritingProjectRatingFlagsSupportedRef.current,
      }: {
        includeExtendedMetadata?: boolean;
        includeAttributeScores?: boolean;
        includeRatingFlags?: boolean;
      } = {}) => {
        const payload: Record<string, unknown> = {
          user_id: normalizedProject.user_id,
          title: normalizedProject.title,
          genre: primaryGenre,
          lyrics: normalizedProject.lyrics || normalizedProject.initial_lyrics,
          quality_score: qualityDescriptor.score,
          music_progress: normalizedProject.music_progress,
          lyrics_progress: normalizedProject.lyrics_progress,
          theme_id: normalizedProject.theme_id,
          chord_progression_id: normalizedProject.chord_progression_id,
          total_sessions: normalizedProject.total_sessions,
          estimated_completion_sessions: estimatedSessions,
          songwriting_project_id: normalizedProject.id,
          status: "released",
        };

        if (includeExtendedMetadata) {
          if (Array.isArray(normalizedProject.co_writers)) {
            payload.co_writers = normalizedProject.co_writers;
          }
          if (Array.isArray(normalizedProject.co_writer_splits)) {
            payload.split_percentages = normalizedProject.co_writer_splits;
          }
        }

        if (includeAttributeScores && normalizedProject.attribute_scores) {
          payload.attribute_scores = normalizedProject.attribute_scores;
        }

        if (includeRatingFlags) {
          payload.rating_hidden = normalizedProject.rating_hidden ?? null;
          payload.rating_visible = normalizedProject.rating_visible ?? null;
          payload.rating_revealed_at = normalizedProject.rating_revealed_at ?? null;
          payload.rating_owner_user_id =
            normalizedProject.rating_owner_user_id ?? normalizedProject.user_id;
          payload.rating_owner_profile_id = normalizedProject.rating_owner_profile_id ?? null;
        }

        return payload;
      };

      const attemptSongInsert = (options?: {
        includeExtendedMetadata?: boolean;
        includeAttributeScores?: boolean;
        includeRatingFlags?: boolean;
      }) =>
        supabase
          .from("songs")
          .insert(buildSongPayload(options))
          .select()
          .single();

      let { data, error } = await attemptSongInsert();

      if (
        error &&
        songwritingProjectExtendedMetadataSupportedRef.current &&
        (isMissingColumnError(error, "co_writers") || isMissingColumnError(error, "split_percentages"))
      ) {
        updateSchemaSupportRef(
          songwritingProjectExtendedMetadataSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectExtendedMetadata,
          false,
        );
        console.warn(
          "Songs extended metadata columns unavailable when converting; retrying without them.",
          error,
        );

        const fallback = await attemptSongInsert({ includeExtendedMetadata: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (
        error &&
        songwritingProjectAttributeScoresSupportedRef.current &&
        (isMissingColumnError(error, "attribute_scores") ||
          SONG_ATTRIBUTE_KEYS.some((key) =>
            ATTRIBUTE_COLUMN_ALIASES[key].some((column) => isMissingColumnError(error, column)),
          ))
      ) {
        updateSchemaSupportRef(
          songwritingProjectAttributeScoresSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectAttributeScores,
          false,
        );
        console.warn(
          "Songs attribute_scores column unavailable when converting; retrying without it.",
          error,
        );

        const fallback = await attemptSongInsert({ includeAttributeScores: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (
        error &&
        songwritingProjectRatingFlagsSupportedRef.current &&
        [
          "rating_hidden",
          "rating_visible",
          "rating_revealed_at",
          "rating_owner_user_id",
          "rating_owner_profile_id",
        ].some((column) => isMissingColumnError(error, column))
      ) {
        updateSchemaSupportRef(
          songwritingProjectRatingFlagsSupportedRef,
          SONGWRITING_SCHEMA_FEATURES.projectRatingFlags,
          false,
        );
        console.warn(
          "Songs rating metadata columns unavailable when converting; retrying without them.",
          error,
        );

        const fallback = await attemptSongInsert({ includeRatingFlags: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      const { error: linkError } = await supabase
        .from("songwriting_projects")
        .update({
          status: 'completed',
          song_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (linkError) throw linkError;
      persistSongwritingSchemaSupport();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Song Created",
        description: "Your completed song has been added to your collection!"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create song from project",
        variant: "destructive"
      });
      console.error("Convert to song error:", error);
    }
  });

  return {
    themes,
    chordProgressions,
    projects,
    isLoadingProjects,
    isLoadingThemes,
    isLoadingChordProgressions,
    createProject,
    updateProject,
    deleteProject,
    startSession,
    completeSession,
    convertToSong,
  };
};