import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Minimal songwriting data hook for basic functionality
// Removed all extended metadata features not supported by current database schema

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
  quality_score: number;
  song_rating?: number;
  status: string | null;
  is_locked: boolean;
  locked_until: string | null;
  song_id?: string | null;
  estimated_completion_sessions?: number;
  estimated_sessions?: number;
  creative_brief?: any;
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
  effort_hours?: number | null;
}

type CreateProjectInput = {
  title: string;
  theme_id: string | null;
  chord_progression_id: string | null;
  initial_lyrics?: string;
  creative_brief?: any;
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

  // Fetch projects
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
          chord_progressions (*)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as SongwritingProject[];
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
          theme_id: projectData.theme_id,
          chord_progression_id: projectData.chord_progression_id,
          initial_lyrics: projectData.initial_lyrics || null,
          quality_score: 0,
          status: 'draft',
          music_progress: 0,
          lyrics_progress: 0,
          total_sessions: 0,
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

  // Start session
  const startSession = useMutation({
    mutationFn: async ({ projectId }: StartSessionInput) => {
      if (!userId) throw new Error("User ID required");
      
      const { data, error } = await supabase
        .from('songwriting_sessions')
        .insert({
          project_id: projectId,
          user_id: userId,
          session_start: new Date().toISOString(),
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

  // Complete session
  const completeSession = useMutation({
    mutationFn: async ({ sessionId, notes, effortHours }: { sessionId: string; notes?: string; effortHours?: number }) => {
      // Calculate progress gains (simplified)
      const musicGain = Math.floor(Math.random() * 500) + 500;
      const lyricsGain = Math.floor(Math.random() * 500) + 500;
      const xpEarned = Math.floor((musicGain + lyricsGain) / 10);
      
      const { data: session, error: sessionError } = await supabase
        .from('songwriting_sessions')
        .update({
          session_end: new Date().toISOString(),
          music_progress_gained: musicGain,
          lyrics_progress_gained: lyricsGain,
          xp_earned: xpEarned,
          notes: notes || null,
        })
        .eq('id', sessionId)
        .select('project_id')
        .single();
      
      if (sessionError) throw sessionError;
      
      // Update project progress
      const { data: project } = await supabase
        .from('songwriting_projects')
        .select('music_progress, lyrics_progress, total_sessions')
        .eq('id', session.project_id)
        .single();
      
      if (project) {
        const newMusicProgress = Math.min(2000, (project.music_progress || 0) + musicGain);
        const newLyricsProgress = Math.min(2000, (project.lyrics_progress || 0) + lyricsGain);
        const completed = newMusicProgress >= 2000 && newLyricsProgress >= 2000;
        
        await supabase
          .from('songwriting_projects')
          .update({
            music_progress: newMusicProgress,
            lyrics_progress: newLyricsProgress,
            total_sessions: (project.total_sessions || 0) + 1,
            status: completed ? 'completed' : 'writing',
            quality_score: Math.floor(((newMusicProgress + newLyricsProgress) / 4000) * 1000),
          })
          .eq('id', session.project_id);
      }
      
      return session;
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

  // Convert to song (stubbed)
  const convertToSong = useMutation({
    mutationFn: async (projectId: string) => {
      throw new Error("Song conversion not yet implemented");
    }
  });

  const pauseSession = useMutation({ 
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      // Pause session stubbed for now
      return { sessionId };
    }
  });

  return {
    themes: songThemes, // Alias for compatibility
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
