import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface SongGenerationStatus {
  audio_url: string | null;
  audio_generation_status: string | null;
  audio_generated_at: string | null;
  audio_generation_started_at: string | null;
}

export function useSongGenerationStatus(songId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["song-generation-status", songId],
    queryFn: async (): Promise<SongGenerationStatus | null> => {
      if (!songId) return null;

      const { data, error } = await supabase
        .from('songs')
        .select('audio_url, audio_generation_status, audio_generated_at, audio_generation_started_at')
        .eq('id', songId)
        .single();

      if (error) {
        console.error('Error fetching song generation status:', error);
        throw error;
      }

      return data;
    },
    enabled: !!songId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: (data) => {
      // Poll every 30 seconds while generating
      if (data?.state?.data?.audio_generation_status === 'generating') {
        return 30 * 1000;
      }
      return false;
    },
  });

  // Check for timeout on the client side
  useEffect(() => {
    if (query.data?.audio_generation_status === 'generating' && query.data?.audio_generation_started_at) {
      const startedAt = new Date(query.data.audio_generation_started_at).getTime();
      const now = Date.now();
      const tenMinutes = 10 * 60 * 1000;

      if (now - startedAt > tenMinutes) {
        // Timeout detected on client side - will be handled by cleanup cron too
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
      }
    }
  }, [query.data, songId, queryClient]);

  const isGenerating = query.data?.audio_generation_status === 'generating';
  const isCompleted = query.data?.audio_generation_status === 'completed';
  const isFailed = query.data?.audio_generation_status === 'failed';
  const hasAudio = !!query.data?.audio_url;

  // Check if timed out
  const isTimedOut = isGenerating && query.data?.audio_generation_started_at && 
    (Date.now() - new Date(query.data.audio_generation_started_at).getTime() > 10 * 60 * 1000);

  return {
    ...query,
    isGenerating,
    isCompleted,
    isFailed: isFailed || isTimedOut,
    isTimedOut,
    hasAudio,
    canRegenerate: (isFailed || isTimedOut) && !hasAudio,
    cannotRegenerate: hasAudio && isCompleted,
  };
}
