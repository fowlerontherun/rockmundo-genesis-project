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
  music_progress: number;
  lyrics_progress: number;
  total_sessions: number;
  estimated_sessions: number;
  quality_score: number;
  status: string;
  is_locked: boolean;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
  song_themes?: SongTheme;
  chord_progressions?: ChordProgression;
}

export interface SongwritingSession {
  id: string;
  project_id: string;
  user_id: string;
  session_start: string;
  session_end: string | null;
  music_progress_gained: number;
  lyrics_progress_gained: number;
  xp_earned: number;
  notes: string | null;
}

export const useSongwritingData = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: themes } = useQuery({
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

  const { data: chordProgressions } = useQuery({
    queryKey: ['chord-progressions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chord_progressions')
        .select('*')
        .order('difficulty', { ascending: true });
      
      if (error) throw error;
      return data as ChordProgression[];
    }
  });

  const { data: projects } = useQuery({
    queryKey: ['songwriting-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songwriting_projects')
        .select(`
          *,
          song_themes (id, name, description, mood),
          chord_progressions (id, name, progression, difficulty)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SongwritingProject[];
    }
  });

  const createProject = useMutation({
    mutationFn: async (projectData: {
      title: string;
      theme_id: string;
      chord_progression_id: string;
      initial_lyrics?: string;
    }) => {
      const { data, error } = await supabase
        .from('songwriting_projects')
        .insert({
          ...projectData,
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Project Created",
        description: "Your songwriting project has been created successfully!"
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

  const startSession = useMutation({
    mutationFn: async (projectId: string) => {
      // First check if project is locked
      const { data: project, error: projectError } = await supabase
        .from('songwriting_projects')
        .select('is_locked, locked_until')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      
      if (project.is_locked && project.locked_until) {
        const lockTime = new Date(project.locked_until);
        if (lockTime > new Date()) {
          throw new Error('Project is currently locked. Please wait before starting a new session.');
        }
      }

      // Lock the project for 1 hour
      const lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const { error: lockError } = await supabase
        .from('songwriting_projects')
        .update({
          is_locked: true,
          locked_until: lockUntil.toISOString()
        })
        .eq('id', projectId);
      
      if (lockError) throw lockError;

      // Create session record
      const { data, error } = await supabase
        .from('songwriting_sessions')
        .insert({
          project_id: projectId,
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      toast({
        title: "Session Started",
        description: "Your songwriting session has begun! You're locked in for 1 hour."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start songwriting session",
        variant: "destructive"
      });
    }
  });

  const completeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      // Get session and project data
      const { data: session, error: sessionError } = await supabase
        .from('songwriting_sessions')
        .select('project_id, user_id')
        .eq('id', sessionId)
        .single();
      
      if (sessionError) throw sessionError;

      // Get current project progress and user skills/attributes
      const { data: project, error: projectError } = await supabase
        .from('songwriting_projects')
        .select('music_progress, lyrics_progress, total_sessions')
        .eq('id', session.project_id)
        .single();
      
      if (projectError) throw projectError;

      // Get user skills and attributes for calculation
      const { data: skills } = await supabase
        .from('player_skills')
        .select('songwriting, creativity, composition')
        .eq('user_id', session.user_id)
        .single();

      const { data: attributes } = await supabase
        .from('player_attributes')
        .select('creative_insight, musical_ability')
        .eq('user_id', session.user_id)
        .single();

      // Calculate progress using the database function
      const { data: progressCalc, error: calcError } = await supabase
        .rpc('calculate_songwriting_progress', {
          p_skill_songwriting: skills?.songwriting || 1,
          p_skill_creativity: skills?.creativity || 1,
          p_skill_composition: skills?.composition || 1,
          p_attr_creative_insight: attributes?.creative_insight || 10,
          p_attr_musical_ability: attributes?.musical_ability || 10,
          p_current_music: project.music_progress,
          p_current_lyrics: project.lyrics_progress
        });

      if (calcError) throw calcError;

      const progressResult = (progressCalc ?? {}) as Record<string, unknown>;
      const coerceNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

      const musicGain = coerceNumber(progressResult.music_gain);
      const lyricsGain = coerceNumber(progressResult.lyrics_gain);
      const xpEarned = coerceNumber(progressResult.xp_earned);

      // Update session with results
      const { error: updateSessionError } = await supabase
        .from('songwriting_sessions')
        .update({
          session_end: new Date().toISOString(),
          music_progress_gained: musicGain,
          lyrics_progress_gained: lyricsGain,
          xp_earned: xpEarned
        })
        .eq('id', sessionId);

      if (updateSessionError) throw updateSessionError;

      // Update project progress
      const newMusicProgress = Math.min(2000, project.music_progress + musicGain);
      const newLyricsProgress = Math.min(2000, project.lyrics_progress + lyricsGain);
      const isComplete = newMusicProgress >= 2000 && newLyricsProgress >= 2000;

      const { error: updateProjectError } = await supabase
        .from('songwriting_projects')
        .update({
          music_progress: newMusicProgress,
          lyrics_progress: newLyricsProgress,
          total_sessions: project.total_sessions + 1,
          status: isComplete ? 'complete' : 'writing',
          is_locked: false,
          locked_until: null
        })
        .eq('id', session.project_id);

      if (updateProjectError) throw updateProjectError;

      return {
        musicGain,
        lyricsGain,
        xpEarned,
        isComplete,
        newMusicProgress,
        newLyricsProgress
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['songwriting-projects'] });
      
      if (result.isComplete) {
        toast({
          title: "Song Completed!",
          description: `Your song is finished! You can now add it to a setlist or record it.`
        });
      } else {
        toast({
          title: "Session Complete",
          description: `Progress made! Music: +${result.musicGain}, Lyrics: +${result.lyricsGain}, XP: +${result.xpEarned}`
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
        .from('songwriting_projects')
        .select(`
          *,
          song_themes (name),
          chord_progressions (name, progression)
        `)
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;

      // Create the final song
      const { data, error } = await supabase
        .from('songs')
        .insert({
          user_id: project.user_id,
          title: project.title,
          genre: project.song_themes?.name || 'Unknown',
          lyrics: project.initial_lyrics,
          quality_score: Math.round(project.quality_score / 20), // Convert to 0-100 scale
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
    createProject,
    startSession,
    completeSession,
    convertToSong
  };
};