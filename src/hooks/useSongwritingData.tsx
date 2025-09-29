import { MutableRefObject, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  estimated_completion_sessions: number;
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
  const songwritingSessionsStartedAtSupportedRef = useRef(true);

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

  const handleMissingSongwritingTableError = (error: unknown): boolean => {
    let handled = false;

    if (isMissingTableError(error, "songwriting_projects")) {
      markTableUnavailable(songwritingProjectsTableAvailableRef, "Songwriting projects", error);
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

      const buildSelect = (includeSessions: boolean, includeStartedAt: boolean) => {
        const selections = [
          "*",
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

      const performQuery = async (includeSessions: boolean, includeStartedAt: boolean) =>
        supabase
          .from("songwriting_projects")
          .select(buildSelect(includeSessions, includeStartedAt))
          .eq("user_id", activeUserId)
          .order("created_at", { ascending: false });

      const includeSessions = songwritingSessionsTableAvailableRef.current;
      const includeStartedAt = includeSessions && songwritingSessionsStartedAtSupportedRef.current;

      const { data, error } = await performQuery(includeSessions, includeStartedAt);

      if (error) {
        if (includeSessions && includeStartedAt && isMissingColumnError(error, "started_at")) {
          songwritingSessionsStartedAtSupportedRef.current = false;
          console.warn(
            "Songwriting sessions started_at column unavailable; falling back to legacy session_start.",
            error,
          );

          const { data: fallbackData, error: fallbackError } = await performQuery(includeSessions, false);

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          return fallbackData as SongwritingProject[];
        }

        if (includeSessions && isMissingTableError(error, "songwriting_sessions")) {
          songwritingSessionsTableAvailableRef.current = false;
          console.warn("Songwriting sessions relation unavailable; refetching without session data.", error);

          const { data: fallbackData, error: fallbackError } = await performQuery(false, false);

          if (fallbackError) {
            if (handleMissingSongwritingTableError(fallbackError)) {
              return [] as SongwritingProject[];
            }
            throw fallbackError;
          }

          songwritingProjectsTableAvailableRef.current = true;
          return fallbackData as SongwritingProject[];
        }

        if (handleMissingSongwritingTableError(error)) {
          return [] as SongwritingProject[];
        }
        throw error;
      }

      songwritingProjectsTableAvailableRef.current = true;
      return data as SongwritingProject[];
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

      const payload = {
        user_id: userId,
        title: projectData.title.trim(),
        theme_id: sanitizedThemeId,
        chord_progression_id: sanitizedProgressionId,
        initial_lyrics: sanitizedLyrics,
        lyrics: sanitizedLyrics,
        estimated_completion_sessions: estimatedSessions,
        estimated_sessions: estimatedSessions,
        quality_score: 1000,
        status: "draft",
        music_progress: 0,
        lyrics_progress: 0,
        total_sessions: 0,
        sessions_completed: 0,
        is_locked: false,
        locked_until: null,
      };

      const { data, error } = await supabase
        .from("songwriting_projects")
        .insert(payload)
        .select()
        .single();

      if (error) {
        handleMissingSongwritingTableError(error);
        throw error;
      }
      return data;
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

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      (Object.entries(updates) as Array<[keyof UpdateProjectInput, unknown]>).forEach(([key, value]) => {
        if (value !== undefined) {
          payload[key] = value;
        }
      });

      if (updates.estimated_completion_sessions !== undefined) {
        payload.estimated_sessions = updates.estimated_completion_sessions;
      }

      if (payload.initial_lyrics !== undefined && payload.lyrics === undefined) {
        payload.lyrics = payload.initial_lyrics;
      }

      const { error } = await supabase
        .from("songwriting_projects")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
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
        .single();

      if (projectError) throw projectError;

      if (project?.is_locked && project.locked_until) {
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
          status: project?.status && project.status !== "draft" ? project.status : "writing",
          updated_at: startedAt.toISOString(),
        })
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
        })
        .select()
        .single();

      if (error) {
        if (songwritingSessionsStartedAtSupportedRef.current && isMissingColumnError(error, "started_at")) {
          songwritingSessionsStartedAtSupportedRef.current = false;
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
            })
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
        .single();

      if (sessionError) throw sessionError;

      const { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select(
          "music_progress, lyrics_progress, total_sessions, estimated_completion_sessions, estimated_sessions, quality_score, status, sessions_completed, theme_id, chord_progression_id"
        )
        .eq("id", session.project_id)
        .single();

      if (projectError) throw projectError;

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

      const { data: progressCalc, error: calcError } = await supabase
        .rpc("calculate_songwriting_progress", {
          p_skill_songwriting: skills?.songwriting || 1,
          p_skill_creativity: skills?.creativity || 1,
          p_skill_composition: skills?.composition || 1,
          p_attr_creative_insight: attributes?.creative_insight || 10,
          p_attr_musical_ability: attributes?.musical_ability || 10,
          p_current_music: project.music_progress,
          p_current_lyrics: project.lyrics_progress,
        });

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
      const currentMusic = project.music_progress ?? 0;
      const currentLyrics = project.lyrics_progress ?? 0;
      const newMusicProgress = Math.min(maxProgress, currentMusic + musicGain);
      const newLyricsProgress = Math.min(maxProgress, currentLyrics + lyricsGain);
      const isComplete = newMusicProgress >= maxProgress && newLyricsProgress >= maxProgress;

      const newTotalSessions = (project.total_sessions ?? 0) + 1;
      const newSessionsCompleted = (project.sessions_completed ?? 0) + 1;
      const targetSessions =
        project.estimated_completion_sessions ??
        project.estimated_sessions ??
        Math.max(newTotalSessions, 3);
      const completionRatio = targetSessions > 0 ? newTotalSessions / targetSessions : 0;

      let nextStatus = project.status ?? "draft";
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
        1 + (project.theme_id ? 0.04 : 0) + (project.chord_progression_id ? 0.04 : 0);

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
      computedQuality = Math.min(2000, Math.max(project.quality_score ?? 0, computedQuality));
      const qualityDescriptor = getSongQualityDescriptor(computedQuality);

      const { error: updateProjectError } = await supabase
        .from("songwriting_projects")
        .update({
          music_progress: newMusicProgress,
          lyrics_progress: newLyricsProgress,
          total_sessions: newTotalSessions,
          sessions_completed: newSessionsCompleted,
          estimated_completion_sessions: targetSessions,
          estimated_sessions: targetSessions,
          status: nextStatus,
          is_locked: false,
          locked_until: null,
          quality_score: computedQuality,
          updated_at: completedAt.toISOString(),
        })
        .eq("id", session.project_id);

      if (updateProjectError) throw updateProjectError;

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
      const { data: project, error: projectError } = await supabase
        .from("songwriting_projects")
        .select(`
          *,
          song_themes (name),
          chord_progressions (name, progression)
        `)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;

      const qualityDescriptor = getSongQualityDescriptor(project.quality_score ?? 0);
      const estimatedSessions =
        project.estimated_completion_sessions ??
        project.estimated_sessions ??
        project.total_sessions ?? 0;

      // Create the final song
      const { data, error } = await supabase
        .from("songs")
        .insert({
          user_id: project.user_id,
          title: project.title,
          genre: project.song_themes?.name || 'Unknown',
          lyrics: project.lyrics || project.initial_lyrics,
          quality_score: qualityDescriptor.score,
          music_progress: project.music_progress,
          lyrics_progress: project.lyrics_progress,
          theme_id: project.theme_id,
          chord_progression_id: project.chord_progression_id,
          total_sessions: project.total_sessions,
          estimated_completion_sessions: estimatedSessions,
          songwriting_project_id: project.id,
          status: 'completed'
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