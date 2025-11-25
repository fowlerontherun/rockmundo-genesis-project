import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateSongDuration } from "@/utils/setlistDuration";

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

export const useSongwritingData = (userId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch themes
  const { data: songThemes = [], isLoading: isLoadingThemes } = useQuery({
    queryKey: ['song-themes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('song_themes')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as SongTheme[];
    }
  });

  // Fetch chord progressions
  const { data: chordProgressions = [], isLoading: isLoadingChordProgressions } = useQuery({
    queryKey: ['chord-progressions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chord_progressions')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ChordProgression[];
    }
  });

  // Fetch projects with sessions and auto-unlock expired locks
  const { data: projects = [], isLoading: isLoadingProjects, refetch: refetchProjects } = useQuery({
    queryKey: ['songwriting-projects', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('songwriting_projects')
        .select(`
          *,
          song_themes (*),
          chord_progressions (*),
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
            notes
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      // Auto-unlock expired projects
      const now = new Date().toISOString();
      const needsUnlock = (data || []).filter(p => 
        p.is_locked && p.locked_until && p.locked_until < now
      );
      
      if (needsUnlock.length > 0) {
        await Promise.all(
          needsUnlock.map(p =>
            supabase
              .from('songwriting_projects')
              .update({ is_locked: false, locked_until: null })
              .eq('id', p.id)
          )
        );
      }
      
      // Order sessions by created_at DESC
      const projectsWithSessions = (data || []).map(project => ({
        ...project,
        songwriting_sessions: (project.songwriting_sessions || []).sort(
          (a: any, b: any) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime()
        ),
        is_locked: needsUnlock.some(p => p.id === project.id) ? false : project.is_locked,
        locked_until: needsUnlock.some(p => p.id === project.id) ? null : project.locked_until,
      }));
      
      return projectsWithSessions as SongwritingProject[];
    }
  });

  // Create project
  const createProject = useMutation({
    mutationFn: async (projectData: CreateProjectInput) => {
      if (!userId) throw new Error("User ID required");
      
      const { data, error } = await supabase
        .from('songwriting_projects')
        .insert({
          user_id: userId,
          title: projectData.title.trim(),
          theme_id: projectData.theme_id || null,
          chord_progression_id: projectData.chord_progression_id || null,
          initial_lyrics: projectData.initial_lyrics || null,
          creative_brief: projectData.creative_brief || null,
          genres: projectData.genres || [],
          purpose: projectData.purpose || null,
          mode: projectData.mode || null,
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
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({ title: "Project Deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  });

  // Start session - always 3 hours
  const startSession = useMutation({
    mutationFn: async ({ projectId }: StartSessionInput) => {
      if (!userId) throw new Error("User ID required");
      
      // Check for scheduling conflicts before starting
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const now = new Date();
      const sessionEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      
      const { data: hasConflict } = await (supabase as any).rpc('check_scheduling_conflict', {
        p_user_id: user.id,
        p_start: now.toISOString(),
        p_end: sessionEnd.toISOString(),
        p_exclude_id: null,
      });

      if (hasConflict) {
        throw new Error('You have another activity scheduled during this time. Please check your schedule.');
      }
      
      // Fixed 3-hour duration
      const lockDuration = 3 * 60 * 60 * 1000;
      const lockedUntil = new Date(Date.now() + lockDuration).toISOString();
      
      // Lock the project
      const { error: lockError } = await supabase
        .from('songwriting_projects')
        .update({ is_locked: true, locked_until: lockedUntil, status: 'writing' })
        .eq('id', projectId);
        
      if (lockError) throw lockError;
      
      // Create session with locked_until timestamp
      const sessionStart = new Date();
      const sessionEndTime = new Date(sessionStart.getTime() + lockDuration);
      
      const { data, error } = await supabase
        .from('songwriting_sessions')
        .insert({
          project_id: projectId,
          user_id: userId,
          session_start: sessionStart.toISOString(),
          locked_until: sessionEndTime.toISOString(),
          music_progress_gained: 0,
          lyrics_progress_gained: 0,
          xp_earned: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({ title: "Session Started" });
    }
  });

  // Complete session with skill-based quality
  const completeSession = useMutation({
    mutationFn: async ({ 
      sessionId, 
      notes, 
      effortHours = 2,
      skillLevels,
      attributes 
    }: { 
      sessionId: string; 
      notes?: string; 
      effortHours?: number;
      skillLevels?: Record<string, number>;
      attributes?: { creative_insight: number; musical_ability: number; technical_mastery: number };
    }) => {
      // Get session and project data
      const { data: session, error: sessionError } = await supabase
        .from('songwriting_sessions')
        .select('project_id, session_end')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;
      if (session.session_end) {
        throw new Error('Session already completed');
      }
      
      // Calculate skill-based progress if skills provided
      let musicGain = 0;
      let lyricsGain = 0;
      
      if (skillLevels && attributes) {
        const basicComposing = skillLevels['songwriting_basic_composing'] || 0;
        const basicLyrics = skillLevels['songwriting_basic_lyrics'] || 0;
        
        // Base progress scales with skills
        const baseProgress = 400 + Math.floor(Math.random() * 200);
        musicGain = Math.floor(baseProgress * (1 + basicComposing / 200));
        lyricsGain = Math.floor(baseProgress * (1 + basicLyrics / 200));
      } else {
        // Fallback to simple calculation
        musicGain = Math.floor(Math.random() * 500) + 500;
        lyricsGain = Math.floor(Math.random() * 500) + 500;
      }
      
      const xpEarned = Math.floor((musicGain + lyricsGain) / 10);
      
      // Update session
      await supabase
        .from('songwriting_sessions')
        .update({
          session_end: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          music_progress_gained: musicGain,
          lyrics_progress_gained: lyricsGain,
          xp_earned: xpEarned,
          notes: notes || null,
        })
        .eq('id', sessionId);
      
      // Update project progress
      const { data: project } = await supabase
        .from('songwriting_projects')
        .select('music_progress, lyrics_progress, total_sessions, sessions_completed')
        .eq('id', session.project_id)
        .single();
      
      if (project) {
        const newMusicProgress = Math.min(2000, (project.music_progress || 0) + musicGain);
        const newLyricsProgress = Math.min(2000, (project.lyrics_progress || 0) + lyricsGain);
        const completed = newMusicProgress >= 2000 && newLyricsProgress >= 2000;
        
        const { error: updateError } = await supabase
          .from('songwriting_projects')
          .update({
            music_progress: newMusicProgress,
            lyrics_progress: newLyricsProgress,
            total_sessions: (project.total_sessions || 0) + 1,
            sessions_completed: (project.sessions_completed || 0) + 1,
            status: completed ? 'completed' : 'writing',
            is_locked: false,
            locked_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.project_id);
        
        if (updateError) throw updateError;
      }
      
      return { sessionId, musicGain, lyricsGain, xpEarned };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({ title: "Session Completed", description: "Progress saved!" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to complete session", variant: "destructive" });
      console.error("Complete session error:", error);
    }
  });

  // Convert to song with quality calculation
  const convertToSong = useMutation({
    mutationFn: async ({ 
      projectId, 
      quality,
      catalogStatus = 'private',
      bandId 
    }: { 
      projectId: string; 
      quality: any;
      catalogStatus?: string;
      bandId?: string;
    }) => {
      if (!userId) throw new Error("User ID required");
      
      const { data: project } = await supabase
        .from('songwriting_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (!project) throw new Error("Project not found");
      
      // Generate random duration between 2:20 and 7:00
      const { durationSeconds, durationDisplay } = generateSongDuration();
      
      // Create song record
      const { data: song, error: songError } = await supabase
        .from('songs')
        .insert({
          user_id: userId,
          original_writer_id: userId,
          title: project.title,
          genre: project.genres?.[0] || null,
          lyrics: project.lyrics,
          quality_score: quality.totalQuality,
          lyrics_strength: quality.lyricsStrength,
          melody_strength: quality.melodyStrength,
          rhythm_strength: quality.rhythmStrength,
          arrangement_strength: quality.arrangementStrength,
          production_potential: quality.productionPotential,
          ownership_type: bandId ? 'band' : 'personal',
          catalog_status: catalogStatus,
          band_id: bandId || null,
          ai_generated_lyrics: project.lyrics?.includes('[AI Generated]') || false,
          duration_seconds: durationSeconds,
          duration_display: durationDisplay,
        })
        .select()
        .single();
      
      if (songError) throw songError;
      
      // Link song to project
      await supabase
        .from('songwriting_projects')
        .update({ song_id: song.id, status: 'converted' })
        .eq('id', projectId);
      
      return song;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
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
      queryClient.invalidateQueries({ queryKey: ["songwriting-projects"] });
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
  };
};
