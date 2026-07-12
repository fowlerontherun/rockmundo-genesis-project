import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logGameActivity } from "@/hooks/useGameActivityLog";

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
  lyrics: string | null;
  music_progress: number;
  lyrics_progress: number;
  total_sessions: number;
  sessions_completed: number;
  estimated_sessions: number;
  quality_score: number;
  song_rating: number | null;
  arrangement_progress?: number | null;
  polish_progress?: number | null;
  consistency_score?: number | null;
  songwriting_breakdown?: any;
  calculation_version?: string | null;
  completed_at?: string | null;
  status: string;
  is_locked: boolean;
  locked_until: string | null;
  song_id: string | null;
  creative_brief: any;
  genres: string[] | null;
  purpose: string | null;
  mode: string | null;
  created_at: string;
  updated_at: string;
  song_themes?: SongTheme;
  chord_progressions?: ChordProgression;
  songwriting_sessions?: SongwritingSession[];
  estimated_completion_sessions?: number;
  effort_hours?: number;
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
  progress_breakdown?: any;
  session_type?: string | null;
  effort_hours?: number;
}

type CreateProjectInput = {
  title: string;
  theme_id?: string | null;
  chord_progression_id?: string | null;
  initial_lyrics?: string;
  creative_brief?: any;
  genres?: string[];
  purpose?: string;
  mode?: string;
  instruments?: string[];
};

type UpdateProjectInput = {
  id: string;
  title?: string;
  theme_id?: string | null;
  chord_progression_id?: string | null;
  initial_lyrics?: string | null;
  lyrics?: string | null;
  quality_score?: number;
  status?: string;
  song_rating?: number | null;
  creative_brief?: any;
};

type StartSessionInput = {
  projectId: string;
  effortHours?: number;
};

export const getSongQualityDescriptor = (score: number) => {
  const normalized = Math.max(0, Math.min(1000, Math.round(score)));
  if (normalized < 300) return { min: 0, max: 299, label: "Amateur", hint: "Keep working", score: normalized };
  if (normalized < 550) return { min: 300, max: 549, label: "Rising", hint: "Getting better", score: normalized };
  if (normalized < 750) return { min: 550, max: 749, label: "Professional", hint: "Great work", score: normalized };
  if (normalized < 901) return { min: 750, max: 900, label: "Hit Potential", hint: "Almost there!", score: normalized };
  return { min: 901, max: 1000, label: "Masterpiece", hint: "Perfection!", score: normalized };
};

export const SONG_RATING_RANGE = { min: 0, max: 1000 } as const;

export const useSongwritingData = (profileId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch themes
  const { data: songThemes = [], isLoading: isLoadingThemes, error: themesError, refetch: refetchThemes } = useQuery({
    queryKey: ['song-themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('song_themes')
        .select('id, name, description, mood')
        .order('name');
      
      if (error) throw error;
      return data as SongTheme[];
    }
  });

  // Fetch chord progressions
  const { data: chordProgressions = [], isLoading: isLoadingChordProgressions, error: chordProgressionsError, refetch: refetchChordProgressions } = useQuery({
    queryKey: ['chord-progressions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chord_progressions')
        .select('id, name, progression, difficulty')
        .order('name');
      
      if (error) throw error;
      return data as ChordProgression[];
    }
  });

  // Fetch projects with sessions and auto-unlock expired locks
  const { data: projects = [], isLoading: isLoadingProjects, error: projectsError, refetch: refetchProjects } = useQuery({
    queryKey: ['songwriting-projects', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from('songwriting_projects')
        .select(`
          id, user_id, title, theme_id, chord_progression_id, initial_lyrics, lyrics, music_progress, lyrics_progress, arrangement_progress, polish_progress, consistency_score, total_sessions, sessions_completed, estimated_sessions, quality_score, song_rating, songwriting_breakdown, calculation_version, completed_at, status, is_locked, locked_until, song_id, creative_brief, genres, purpose, mode, created_at, updated_at, effort_hours,
          song_themes (id, name, description, mood),
          chord_progressions (id, name, progression, difficulty),
          songwriting_sessions (
            id,
            project_id,
            user_id,
            session_start,
            session_end,
            completed_at,
            music_progress_gained,
            lyrics_progress_gained,
            xp_earned,
            notes,
            progress_breakdown,
            session_type
          )
        `)
        .eq('profile_id', profileId)
        .order('updated_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Auto-unlock expired projects - do this in background, don't block the query
      const now = new Date().toISOString();
      const needsUnlock = (data || []).filter(p => 
        p.is_locked && p.locked_until && p.locked_until < now
      );
      
      // Fire and forget - don't await, just update in background
      if (needsUnlock.length > 0) {
        Promise.all(
          needsUnlock.map(p =>
            supabase
              .from('songwriting_projects')
              .update({ is_locked: false, locked_until: null })
              .eq('id', p.id)
          )
        ).catch(() => undefined);
      }
      
      // Order sessions by created_at DESC - mark expired locks as unlocked in UI immediately
      const projectsWithSessions = (data || []).map(project => {
        const isExpired = project.is_locked && project.locked_until && project.locked_until < now;
        return {
          ...project,
          songwriting_sessions: (project.songwriting_sessions || []).sort(
            (a: any, b: any) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime()
          ),
          is_locked: isExpired ? false : project.is_locked,
          locked_until: isExpired ? null : project.locked_until,
        };
      });
      
      return projectsWithSessions as SongwritingProject[];
    }
  });

  // Create project
  const createProject = useMutation({
    mutationFn: async (projectData: CreateProjectInput) => {
      if (!profileId) throw new Error("Profile ID required");
      
      // Get the auth user for user_id field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from('songwriting_projects')
        .insert({
          user_id: user.id,
          profile_id: profileId,
          title: projectData.title.trim(),
          theme_id: projectData.theme_id || null,
          chord_progression_id: projectData.chord_progression_id || null,
          initial_lyrics: projectData.initial_lyrics || null,
          // Keep canonical lyrics in sync from first save so convertToSong
          // uses player-entered lyrics instead of falling back to AI generation.
          lyrics: projectData.initial_lyrics || null,
          creative_brief: projectData.creative_brief || null,
          genres: projectData.genres || [],
          purpose: projectData.purpose || null,
          mode: projectData.mode || null,
          instruments: projectData.instruments || [],
          quality_score: 0,
          song_rating: null,
          status: 'draft',
          music_progress: 0,
          lyrics_progress: 0,
          total_sessions: 0,
          sessions_completed: 0,
          estimated_sessions: 3,
          is_locked: false,
          locked_until: null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      toast({ title: "Project Created", description: "New songwriting project started!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
      console.error("Create project error:", error);
    }
  });

  // Update project
  const updateProject = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProjectInput) => {
      const { error } = await supabase
        .from('songwriting_projects')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      toast({ title: "Project Updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update project", variant: "destructive" });
      console.error("Update project error:", error);
    }
  });

  // Delete project
  const deleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('songwriting_projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      toast({ title: "Project Deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  });

  // Start session through server-authoritative RPC with validated duration and activity blocking
  const startSession = useMutation({
    mutationFn: async ({ projectId, effortHours = 1 }: StartSessionInput) => {
      if (!profileId) throw new Error("Profile ID required");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await (supabase as any).rpc('start_songwriting_session', {
        p_profile_id: profileId,
        p_project_id: projectId,
        p_effort_hours: effortHours,
      });
      if (error) throw error;

      logGameActivity({
        userId: user.id,
        activityType: 'songwriting_session_started',
        activityCategory: 'songwriting',
        description: `Started ${effortHours}-hour songwriting session`,
        metadata: { projectId, sessionId: data?.session_id, lockedUntil: data?.locked_until, balanceVersion: data?.balance_version }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-activities'] });
      toast({ title: "Session Started", description: "Songwriting session in progress" });
    }
  });

  // Complete session using server-authoritative skill, attribute, genre, collaboration and wellness calculation
  const completeSession = useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes?: string; effortHours?: number; skillLevels?: Record<string, number>; attributes?: { creative_insight: number; musical_ability: number; technical_mastery: number }; }) => {
      if (!profileId) throw new Error("Profile ID required");
      const { data, error } = await (supabase as any).rpc('complete_songwriting_session', {
        p_profile_id: profileId,
        p_session_id: sessionId,
        p_notes: notes || null,
      });
      if (error) throw error;

      logGameActivity({
        userId: profileId,
        activityType: 'songwriting_session_completed',
        activityCategory: 'songwriting',
        description: `Completed songwriting session with +${data?.music_progress_gained ?? 0} music, +${data?.lyrics_progress_gained ?? 0} lyrics progress`,
        metadata: { sessionId, breakdown: data?.breakdown, xpAwards: data?.xp_awards },
        amount: data?.xp_earned ?? 0
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      toast({ title: "Session Completed", description: "Progress saved!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to complete session", variant: "destructive" });
      console.error("Complete session error:", error);
    }
  });

  // Convert to song using the server-authoritative final quality calculator.
  const convertToSong = useMutation({
    mutationFn: async ({ projectId, catalogStatus = 'private', bandId }: { projectId: string; quality?: any; catalogStatus?: string; bandId?: string; }) => {
      if (!profileId) throw new Error("Profile ID required");
      const { data, error } = await (supabase as any).rpc('complete_songwriting_project', {
        p_profile_id: profileId,
        p_project_id: projectId,
        p_catalog_status: catalogStatus,
        p_band_id: bandId || null,
      });
      if (error) throw error;

      logGameActivity({
        userId: profileId,
        bandId,
        activityType: 'song_created',
        activityCategory: 'songwriting',
        description: `Created new song from songwriting project`,
        metadata: {
          songId: data?.song_id,
          projectId,
          qualityScore: data?.final_score,
          catalogStatus,
          breakdown: data?.breakdown,
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects', profileId] });
      toast({ title: "Song Created!", description: "Added to your catalog" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to create song", variant: "destructive" });
      console.error("Convert to song error:", error);
    }
  });

  // Pause session
  const pauseSession = useMutation({ 
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const { data, error } = await supabase
        .from("songwriting_sessions")
        .update({ 
          session_end: new Date().toISOString(),
          notes: "Session paused by user"
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["songwriting-projects", profileId] });
      toast({ title: "Session paused successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to pause session",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  });

  return {
    themes: songThemes,
    songThemes,
    chordProgressions,
    projects,
    isLoadingProjects,
    isLoadingThemes,
    isLoadingChordProgressions,
    createProject,
    updateProject,
    deleteProject,
    startSession,
    pauseSession,
    completeSession,
    convertToSong,
    refetchProjects,
    projectsError,
    themesError,
    chordProgressionsError,
    refetchThemes,
    refetchChordProgressions,
  };
};
