import { MutableRefObject, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SONGWRITING_SCHEMA_FEATURES = {
  lyrics: "lyrics-column",
  estimatedCompletion: "estimated-completion",
  sessionsCompleted: "sessions-completed",
  sessionsStartedAt: "sessions-started-at",
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
}

type CreateProjectInput = {
  title: string;
  theme_id: string | null;
  chord_progression_id: string | null;
  initial_lyrics?: string;
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
};

type CompleteSessionInput = {
  sessionId: string;
  notes?: string;
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

      const buildPayload = () => {
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

        return payload;
      };

      const attemptInsert = () =>
        supabase
          .from("songwriting_projects")
          .insert(buildPayload() as any)
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

      const buildPayload = (includeEstimated: boolean) => {
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

        return payload;
      };

      const attemptUpdate = (includeEstimated: boolean) =>
        supabase
          .from("songwriting_projects")
          .update(buildPayload(includeEstimated) as Record<string, unknown>)
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
    mutationFn: async (projectId: string) => {
      const { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select("is_locked, locked_until, status")
        .eq("id", projectId)
        .maybeSingle();

      if (projectError) throw projectError;
      if (!project) throw new Error("Project not found");

      if (project.is_locked && project.locked_until) {
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
      const lockUntil = new Date(startedAt.getTime() + 60 * 60 * 1000);

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

        throw error;
      }
      return data as SongwritingSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Session Started",
        description: "Your songwriting session has begun! You're locked in for 1 hour."
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
    mutationFn: async ({ sessionId, notes }: CompleteSessionInput) => {
      const { data: session, error: sessionError } = await supabase
        .from("songwriting_sessions")
        .select("project_id, user_id")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) throw new Error("Session not found");

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
        ]
          .filter((field): field is string => typeof field === "string" && field.length > 0)
          .join(", ");

      const includeEstimatedCompletion = songwritingEstimatedCompletionSupportedRef.current;

      let { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select(buildProjectSelect(includeEstimatedCompletion))
        .eq("id", session.project_id)
        .maybeSingle();

      if (projectError && includeEstimatedCompletion && isMissingColumnError(projectError, "estimated_completion_sessions")) {
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

      project = normalizeProjectRow(project as any) as any;

      const [{ data: skills, error: skillsError }, { data: attributes, error: attributesError }] =
        await Promise.all([
          supabase
            .from("player_skills")
            .select("songwriting, creativity, composition")
            .eq("user_id", session.user_id)
            .maybeSingle(),
          supabase
            .from("player_attributes")
            .select("creative_insight, musical_ability")
            .eq("user_id", session.user_id)
            .maybeSingle(),
        ]);

      if (skillsError && skillsError.code !== "PGRST116") {
        throw skillsError;
      }

      if (attributesError && attributesError.code !== "PGRST116") {
        throw attributesError;
      }

      const progressParameters: Record<string, unknown> = {
        p_skill_songwriting: skills?.songwriting || 1,
        p_skill_creativity: skills?.creativity || 1,
        p_skill_composition: skills?.composition || 1,
        p_attr_creative_insight: attributes?.creative_insight || 10,
        p_attr_musical_ability: attributes?.musical_ability || 10,
        p_current_music: (project as any).music_progress ?? 0,
        p_current_lyrics: (project as any).lyrics_progress ?? 0,
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

      const completedAt = new Date();

      const { error: updateSessionError } = await supabase
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

      if (updateSessionError) throw updateSessionError;

      const maxProgress = 2000;
      const proj = project as any;
      const currentMusic = proj.music_progress ?? 0;
      const currentLyrics = proj.lyrics_progress ?? 0;
      const newMusicProgress = Math.min(maxProgress, currentMusic + musicGain);
      const newLyricsProgress = Math.min(maxProgress, currentLyrics + lyricsGain);
      const isComplete = newMusicProgress >= maxProgress && newLyricsProgress >= maxProgress;

      const newTotalSessions = (proj.total_sessions ?? 0) + 1;
      const previousSessionsCompleted =
        typeof proj.sessions_completed === "number" && Number.isFinite(proj.sessions_completed)
          ? proj.sessions_completed
          : Math.max(0, proj.total_sessions ?? 0);
      const newSessionsCompleted = previousSessionsCompleted + 1;
      const targetSessions =
        proj.estimated_completion_sessions ??
        proj.estimated_sessions ??
        Math.max(newTotalSessions, 3);
      const completionRatio = targetSessions > 0 ? newTotalSessions / targetSessions : 0;

      let nextStatus = proj.status ?? "draft";
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
        1 + (proj.theme_id ? 0.04 : 0) + (proj.chord_progression_id ? 0.04 : 0);

      const progressComponent = 0.45 * Math.min(1, progressRatio);
      const skillComponent = 0.35 * Math.min(1, skillAverage / 120);
      const attributeComponent = 0.2 * Math.min(1, attributeAverage / 140);

      let computedQuality = Math.round(
        2000 *
          (progressComponent + skillComponent + attributeComponent) *
          efficiencyModifier *
          consistencyModifier *
          themeModifier
      );
      computedQuality = Math.min(2000, Math.max(proj.quality_score ?? 0, computedQuality));
      const qualityDescriptor = getSongQualityDescriptor(computedQuality);

      const buildUpdatePayload = (includeEstimated: boolean) => ({
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
      });

      const attemptProjectUpdate = (includeEstimated: boolean) =>
        supabase
          .from("songwriting_projects")
          .update(buildUpdatePayload(includeEstimated) as Record<string, unknown>)
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
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });

      if (result.isComplete) {
        toast({
          title: "Song Completed!",
          description: `Your project hit 100% on both tracks. Quality locked at ${result.qualityDescriptor.label}.`
        });
      } else {
        toast({
          title: "Session Complete",
          description: `Progress made! Music +${result.musicGain}, Lyrics +${result.lyricsGain}, XP +${result.xpEarned}. Quality now ${result.qualityDescriptor.label}.`
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

      // Create the final song
      const { data, error } = await supabase
        .from("songs")
        .insert({
          user_id: normalizedProject.user_id,
          title: normalizedProject.title,
          genre: normalizedProject.song_themes?.name || 'Unknown',
          lyrics: normalizedProject.lyrics || normalizedProject.initial_lyrics,
          quality_score: qualityDescriptor.score,
          music_progress: normalizedProject.music_progress,
          lyrics_progress: normalizedProject.lyrics_progress,
          theme_id: normalizedProject.theme_id,
          chord_progression_id: normalizedProject.chord_progression_id,
          total_sessions: normalizedProject.total_sessions,
          estimated_completion_sessions: estimatedSessions,
          songwriting_project_id: normalizedProject.id,
          status: 'released'
        })
        .select()
        .single();

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