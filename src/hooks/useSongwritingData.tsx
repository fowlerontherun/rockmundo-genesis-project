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
  estimated_sessions: number;
  quality_score: number;
  status: string;
  is_locked: boolean;
  locked_until: string | null;
  sessions_completed?: number;
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
  theme_id: string;
  chord_progression_id: string;
  initial_lyrics?: string;
  estimated_sessions?: number;
  quality_score?: number;
  status?: string;
  song_id?: string | null;
};

type UpdateProjectInput = {
  id: string;
  title?: string;
  theme_id?: string | null;
  chord_progression_id?: string | null;
  estimated_sessions?: number;
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

export const useSongwritingData = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: themes, isLoading: isLoadingThemes } = useQuery({
    queryKey: ["song-themes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_themes")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as SongTheme[];
    },
  });

  const { data: chordProgressions, isLoading: isLoadingChordProgressions } = useQuery({
    queryKey: ["chord-progressions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chord_progressions")
        .select("*")
        .order("difficulty", { ascending: true });

      if (error) throw error;
      return data as ChordProgression[];
    },
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["songwriting-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songwriting_projects")
        .select(`
          *,
          song_themes (id, name, description, mood),
          chord_progressions (id, name, progression, difficulty),
          songwriting_sessions (
            id,
            project_id,
            user_id,
            session_start,
            session_end,
            started_at,
            completed_at,
            locked_until,
            music_progress_gained,
            lyrics_progress_gained,
            xp_earned,
            notes,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SongwritingProject[];
    },
  });

  const createProject = useMutation({
    mutationFn: async (projectData: CreateProjectInput) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("User must be signed in to create a songwriting project");
      }

      const payload = {
        user_id: userId,
        title: projectData.title,
        theme_id: projectData.theme_id || null,
        chord_progression_id: projectData.chord_progression_id || null,
        initial_lyrics: projectData.initial_lyrics ?? null,
        lyrics: projectData.initial_lyrics ?? null,
        estimated_sessions: projectData.estimated_sessions ?? 3,
        quality_score: projectData.quality_score ?? 50,
        status: projectData.status ?? "writing",
        song_id: projectData.song_id ?? null,
        music_progress: 0,
        lyrics_progress: 0,
        total_sessions: 0,
        sessions_completed: 0,
      };

      const { data, error } = await supabase
        .from("songwriting_projects")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
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
        description: "Failed to create songwriting project",
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
        .select("is_locked, locked_until")
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
          started_at: startedAt.toISOString(),
          locked_until: lockUntil.toISOString(),
          notes: null,
        })
        .select()
        .single();

      if (error) throw error;
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
          "music_progress, lyrics_progress, total_sessions, estimated_sessions, quality_score, status, sessions_completed"
        )
        .eq("id", session.project_id)
        .single();

      if (projectError) throw projectError;

      const { data: skills } = await supabase
        .from("player_skills")
        .select("songwriting, creativity, composition")
        .eq("user_id", session.user_id)
        .single();

      const { data: attributes } = await supabase
        .from("player_attributes")
        .select("creative_insight, musical_ability")
        .eq("user_id", session.user_id)
        .single();

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
      const newMusicProgress = Math.min(maxProgress, (project.music_progress || 0) + musicGain);
      const newLyricsProgress = Math.min(maxProgress, (project.lyrics_progress || 0) + lyricsGain);
      const isComplete = newMusicProgress >= maxProgress && newLyricsProgress >= maxProgress;

      const newTotalSessions = (project.total_sessions || 0) + 1;
      const newSessionsCompleted = (project.sessions_completed || project.total_sessions || 0) + 1;
      const estimatedSessions = project.estimated_sessions || 0;
      const completionRatio = estimatedSessions > 0 ? newTotalSessions / estimatedSessions : 0;

      let nextStatus = project.status || "writing";
      if (isComplete) {
        nextStatus = "completed";
      } else if (completionRatio >= 1) {
        nextStatus = "ready_to_finish";
      } else if (completionRatio >= 0.66) {
        nextStatus = "arranging";
      } else if (!nextStatus || nextStatus === "draft") {
        nextStatus = "writing";
      }

      const computedQuality = Math.min(
        100,
        Math.max(
          project.quality_score || 0,
          Math.round(((newMusicProgress + newLyricsProgress) / (maxProgress * 2)) * 100)
        )
      );

      const { error: updateProjectError } = await supabase
        .from("songwriting_projects")
        .update({
          music_progress: newMusicProgress,
          lyrics_progress: newLyricsProgress,
          total_sessions: newTotalSessions,
          sessions_completed: newSessionsCompleted,
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
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });

      if (result.isComplete) {
        toast({
          title: "Song Completed!",
          description: "Your project hit 100% on both tracks. Time to release it!"
        });
      } else {
        toast({
          title: "Session Complete",
          description: `Progress made! Music +${result.musicGain}, Lyrics +${result.lyricsGain}, XP +${result.xpEarned}, Quality ${result.qualityScore}%`
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

      // Create the final song
      const { data, error } = await supabase
        .from("songs")
        .insert({
          user_id: project.user_id,
          title: project.title,
          genre: project.song_themes?.name || 'Unknown',
          lyrics: project.lyrics || project.initial_lyrics,
          quality_score: Math.round(project.quality_score ?? 0),
          music_progress: project.music_progress,
          lyrics_progress: project.lyrics_progress,
          theme_id: project.theme_id,
          chord_progression_id: project.chord_progression_id,
          total_sessions: project.total_sessions,
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